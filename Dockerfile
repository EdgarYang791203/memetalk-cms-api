# 使用官方 Node.js 鏡像作為基礎鏡像
FROM node:18

# 設定工作目錄
WORKDIR /usr/src/app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝相依套件
RUN npm install

# 複製應用程式的所有檔案
COPY . .

# Cloud Run 預設會使用 8080 埠號
EXPOSE 8080

# 啟動應用程式
CMD ["npx", "nodemon", "--legacy-watch", "./*.ts", "-e", "ts", "--exec", "ts-node", "./index.ts"]