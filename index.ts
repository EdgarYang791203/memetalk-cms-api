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

const app = express();
const port = process.env.PORT || 3000;
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

// 啟動伺服器
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
