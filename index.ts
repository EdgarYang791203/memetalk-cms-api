import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";

interface UserType {
  xata_id?: string;
  xata_createdat?: string;
  displayName: string;
  photoURL: string;
  uid: string;
  email: string;
}

interface MemePost {
  title: string;
  src: string;
  url: string;
  memeId: number;
  pageview: number;
  total_like_count: number;
  tags: [] | { id: string; title: string }[];
  liked_user: string[];
  created_date: string;
  hashtag?: string;
  comments?: {
    name: string;
    content: string;
    avatar?: string;
  }[];
}

const app = express();
const port = process.env.PORT || 3001;
const prisma = new PrismaClient();

// 使用 cors 中間件，允許來自 localhost:5173 的請求
app.use(
  cors({
    origin: process.env.CORS_ORIGIN, // 允許前端的 URL
  })
);

// 啟用 JSON 解析
app.use(express.json());

// 測試端點
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hello, World!" });
});

app.get("/test-db-connection", async (_req: Request, res: Response) => {
  try {
    // 試圖進行簡單的查詢操作來測試資料庫連接
    const testConnection = await prisma.$queryRaw`SELECT 1`;
    if (testConnection) {
      res.json({ message: "Database connection successful!" });
    } else {
      res.status(500).json({ message: "Failed to connect to the database" });
    }
  } catch (error) {
    console.error("Error connecting to database:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

const apiRouter = express.Router();

app.use("/api", apiRouter);

apiRouter.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        xata_createdat: "asc",
      },
      select: {
        xata_id: true,
        displayName: true,
        photoURL: true,
        uid: true,
        email: true,
        xata_createdat: true,
      },
    });
    console.log("Fetched users:", users);
    res.json(users);
  } catch (error: any) {
    console.error("Error fetching users:", error.message || error);
    res.status(500).json({
      message: "Internal Server Error" ,
      error: error.message || error,
    });
  }
})

apiRouter.get("/users/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const user = await prisma.user.findUnique({
      where: {
        xata_id: id, // 假設你要找的資料 id 為 1
      },
    });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
});

const validation = (payload: Required<UserType>) => {
  const verifiedKeys: Array<keyof UserType> = [
    "displayName",
    "photoURL",
    "uid",
    "email",
  ];
  for (let index = 0; index < verifiedKeys.length; index++) {
    const key = verifiedKeys[index];
    // 檢查欄位是否為空
    if (!payload[key] || payload[key] === "") {
      return `${key} is required`; // 直接返回具體錯誤訊息
    }
    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      return "Invalid email format";
    }

    return null;
  }
};

apiRouter.post("/users", async (req: Request, res: Response) => {
  const errorMessage = validation(req.body);
  if (errorMessage) {
    return res.status(422).json({
      message: errorMessage,
    });
  }
  const { displayName, photoURL, uid, email } = req.body;

  const newUser: UserType = {
    displayName,
    photoURL,
    uid,
    email,
  };

  try {
    // 驗證 uid 是否已存在
    const existingUser = await prisma.user.findUnique({
      where: {
        uid,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Account already exists with this UID",
      });
    }

    await prisma.user.create({
      data: newUser,
    });

    res.status(201).json(newUser);
  } catch {
    res.status(500).send("Internal Server Error");
  }
});

apiRouter.get('/hot-meme', async (req: Request, res: Response) => {
  try {
    const memes = await prisma.meme.findMany({
      orderBy: {
        xata_createdat: "asc",
      },
      include: {
        comments: true, // 包含關聯的 comments
      },
    });
    const selectedMemes = memes.map(meme => ({
      title: meme.title,
      src: meme.src,
      url: meme.url,
      memeId: meme.memeId,
      created_date: meme.created_date,
      pageview: meme.pageview,
      total_like_count: meme.total_like_count,
      liked_user: meme.liked_user,
      hashtag: meme.hashtag,
      tags: (() => {
        try {
          if (typeof meme.tags === 'string') {
            return JSON.parse(meme.tags);
          }
          return meme.tags || [];  // 若 `tags` 已經是物件，直接返回
        } catch (error) {
          console.error('Error parsing tags:', error);
          return [];
        }
      })(),
      comments: meme.comments ?? [],
    }));
    console.log("Fetched memes:", selectedMemes);
    res.json({ data: selectedMemes });
  } catch (error: any) {
    console.error("Error fetching memes:", error.message || error);
    res.status(500).json({
      message: "Internal Server Error" ,
      error: error.message || error,
    });
  }
})

const validationMeme = (payload: Required<MemePost>) => {
  const verifiedKeys: Array<keyof MemePost> = [
    "title",
    "src",
    "url",
    "memeId",
    "created_date",
  ];
  for (let index = 0; index < verifiedKeys.length; index++) {
    const key = verifiedKeys[index];
    // 檢查欄位是否為空
    if (!payload[key] || payload[key] === "") {
      return `${key} is required`; // 直接返回具體錯誤訊息
    }
  }
  if (payload.hashtag && typeof payload.hashtag !== 'string') {
    return 'hashtag must be type string'
  }
  if (typeof payload.tags !== 'object') {
    return 'hashtag must be type array'
  }
  if (payload.comments && !payload.comments.length) {
    return "Invalid comments format";
  }
  return null;
};

apiRouter.post('/hot-meme', async (req: Request, res: Response) => {
  const errorMessage = validationMeme(req.body);
  if (errorMessage) {
    return res.status(422).json({
      message: errorMessage,
    });
  }

  // 驗證 uid 是否已存在
  const existingMeme = await prisma.meme.findUnique({
    where: {
      memeId: req.body.memeId,
    },
  });

  if (existingMeme) {
    return res.status(409).json({
      message: "Meme already exists with this memeId",
    });
  }

  const { title, src, url, memeId, pageview, total_like_count, tags, liked_user, created_date, hashtag, comments } = req.body;

  try {
    const newMeme: MemePost = {
      title, src, url, memeId, pageview, total_like_count, tags, liked_user, created_date, hashtag, comments
    }
    await prisma.meme.create({
      data: {
        ...newMeme,
        tags: typeof tags === 'object' ? JSON.stringify(tags) : '[]',
        comments: newMeme.comments && newMeme.comments.length ? {
          create: newMeme.comments.map(comment => ({
            memeId, // 使用外部的 memeId
            name: comment.name,
            content: comment.content,
            avatar: comment.avatar,
          })),
        } : undefined,
      },
      select: {
        title: true,
        src: true,
        url: true,
        memeId: true,
        pageview: true,
        total_like_count: true,
        liked_user: true,
        created_date: true,
        hashtag: true,
        tags: true,
        comments: true,
      },
    })

    res.status(201).json(newMeme);
  } catch (error) {
    console.error("Error creating meme:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
})

apiRouter.put('/meme/:memeId/like', async (req: Request, res: Response) => {
  const { uid } = req.body;
  const { memeId } = req.params;

  try {
    // 找到當前的 meme 資料
    const meme = await prisma.meme.findUnique({
      where: { memeId: Number(memeId) },
    });

    if (!meme) {
      return res.status(404).json({ message: "Meme not found" });
    }

    // 檢查 liked_user 陣列中是否已包含該 uid
    const isLiked = meme.liked_user.includes(uid);

    // 更新 liked_user 陣列：按讚則加入，取消則移除
    const updatedMeme = await prisma.meme.update({
      where: { memeId: Number(memeId) },
      data: {
        liked_user: isLiked
          ? { set: meme.liked_user.filter(user => user !== uid) } // 取消按讚，移除 uid
          : { push: uid }, // 按讚，將 uid 加入
      },
    });

    // 回傳更新後的 meme 資料
    res.status(200).json(updatedMeme);
  } catch (error) {
    console.error("Error updating meme:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
