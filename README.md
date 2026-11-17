# web-architecture

一個最小留言板，用來分五步學習 web app architecture。

每一步只增加一項使用者需求，讓架構因為實際問題逐步長出來。
完整的需求、平台選擇、架構圖與進度記錄在 **[docs/web-app-architecture-lab.md](docs/web-app-architecture-lab.md)** —— 那份是跨 session 的交接檔，開始任何工作前先讀它。

目前進度：**Step 2（靜態留言板）**

## 開發

```bash
npm install
npm run dev
```

開 http://localhost:3000

```bash
npm run build   # 產生 production build，並印出每個 route 是 static 還是 dynamic
```

## Stack

Next.js（App Router）· TypeScript · Tailwind CSS，部署於 Vercel。
auth 與 database 於 Step 3、4 加入（Supabase），object storage 於 Step 5 加入（Vercel Blob）。
