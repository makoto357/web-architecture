# Web App Architecture Lab — 最小留言板

跨 session 的交接檔。**每一步開始時閱讀，結束前更新。**

> [!IMPORTANT]
> 下一位 agent：不要把這份文件當成絕對正確的事實。開始工作前先對照實際程式碼、部署設定與平台
> 狀態；發現內容過期時，**先修正這份文件**再往下做。
>
> 本檔只記錄環境變數與 secret 的**名稱**，不得寫入任何 credential 值。
> 更新時保留前一步的架構圖與決策；決策失效時標記原因，不要直接覆蓋。

參考文章：[Web App Architecture：production web app 在雲端上有哪些部分](https://tech.mincontent.com/articles/frontend-to-fullstack/web-app-architecture)

---

## 1. 固定需求與範圍

同一個最小留言板，分五步，每步只增加一項使用者需求。

| 步驟 | 使用者需求 | 新增的架構角色 |
| --- | --- | --- |
| 1 | — | 選定主平台與外接服務（不建立專案、不部署） |
| 2 | 看得到留言（寫死的假資料） | static hosting / CDN |
| 3 | 註冊、登入、保持登入、登出 | auth |
| 4 | 登入者建立純文字留言 | application runtime + managed DB |
| 5 | 留言可附一張圖片 | object storage |

### 範圍內

- 五步全部在免費額度內完成，不依賴限時試用 credit
- 使用平台提供的免費子網域
- Step 4 起：backend 驗證 session，作者 ID 一律取自驗證結果，不信任前端傳來的 `userId`
- Step 5：權限由 backend 或 storage access rules 強制執行；限制檔案類型與大小

### 範圍外

queue、external API、email、自有網域、完整 production hardening（secret 管理、alert、還原演練、
流量限制、staging 環境）。

> 這是建立架構概念的入門練習，**不是 production 選型**，也不是 production-ready 檢查清單。

---

## 2. 選定的主平台與外接服務

**主平台：Vercel（Hobby）　外接：Supabase（Free）**

外接方式採**直接註冊 Supabase 帳號**，不走 Vercel Marketplace integration。
理由：手動設定 env var 正是 twelve-factor「backing services as attached resources」的實作，
練習的目的是看見接線，而不是把接線自動化掉。（取捨見 §5）

### 角色 → 服務對照

| 角色 | 服務 | 導入於 | 備註 |
| --- | --- | --- | --- |
| Domain / DNS | Vercel 免費子網域 | Step 2 | 不購買網域 |
| CDN | Vercel CDN（內建） | Step 2 | 平台代管 |
| Load balancer / 反向代理 | Vercel（內建） | Step 2 | TLS、健康檢查、WAF 皆由平台處理，不另挑產品 |
| Static hosting | Vercel Hobby | Step 2 | |
| Auth | Supabase Auth | Step 3 | cookie-based session |
| Application runtime | Vercel Functions | Step 4 | Node 相容 |
| Database | Supabase Postgres | Step 4 | |
| Object storage | Vercel Blob | Step 5 | client upload + token，見 §6 |
| KV store | 不使用 | — | 無獨立低延遲 KV 需求 |
| Queue | 不使用 | — | 無背景工作 |
| Secrets store | Vercel Environment Variables | Step 3 起 | |
| Observability | 平台內建 log | — | 不接 Sentry |
| Email | 不使用 | — | 若 Step 3 需要驗證信，優先選不寄信的登入方式 |

### 預計使用的環境變數名稱

**僅記錄名稱，實際值存放於 Vercel Environment Variables 與本機未納入 Git 的 `.env.local`。**

| 名稱 | 導入於 | 可否暴露於前端 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Step 3 | 可 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Step 3 | 可 |
| `SUPABASE_SECRET_KEY` | Step 4 | **否，僅 server 端** |
| `BLOB_READ_WRITE_TOKEN` | Step 5 | **否，僅 server 端** |

> `NEXT_PUBLIC_` 前綴假設採用 Next.js，但**前端框架尚未決定**（見 §7 未解問題 3）。
> 若改用其他框架，前綴規則不同，本表需一併修正。
> 實際名稱以各服務當下的官方文件為準，Step 3 起逐步確認並回來修正本表。

---

## 3. 免費方案證據（官方文件，查閱日期 2026-11-16 / 11-17）

### Vercel Hobby

| 項目 | 內容 |
| --- | --- |
| 費用 | 免費；註冊頁（`vercel.com/signup`）僅 Google / GitHub / ChatGPT / Apple / Email，**無付款欄位** |
| Functions | 1,000,000 invocations、4 CPU-hrs、360 GB-hrs |
| CDN | 1,000,000 requests、Fast Data Transfer 100 GB |
| Blob | 1 GB/月儲存、Simple Ops 10,000、Advanced Ops 2,000、Data Transfer 10 GB |
| 超額行為（一般） | **硬停**。Hobby 文件原文：「in most cases, if you exceed your usage limits on the Hobby plan, you will have to wait until 30 days have passed before you can use the feature again」 |
| 超額行為（Blob） | **明文不收費**。原文：「You **will not pay for any additional usage**. However, you will not be able to access Vercel Blob if limits are exceeded… wait until 30 days have passed」 |
| 限制 | **runtime log 只保留 1 小時**；function 最長 300s |
| 限個人、非商業用途 | ✅ **已確認於 Terms of Service §4（2026-11-17 查閱）**：「You shall only use the Services under a Hobby plan for your personal or non-commercial use.」同條另允許 Vercel 在造成「delays or performance problems」時關閉 Hobby 專案或部署。本練習為個人學習用途，符合 |

> 該限制只寫在 Terms of Service：`vercel.com/docs/plans/hobby` 全頁未提；
> `docs/limits/fair-use-guidelines` 抓取原始頁面後搜尋 `commercial` 為 0 筆，且其
> 「Examples of fair use / Never fair use」兩節在抓到的內容中為空（可能為前端動態載入），
> 因此 fair use 的具體判準暫無可引用的原文。

來源：[Hobby Plan](https://vercel.com/docs/plans/hobby)、[Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)、[Terms of Service](https://vercel.com/legal/terms)、[Blob Pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)、註冊頁 `vercel.com/signup`（2026-11-17 實地查看）

### Supabase Free

| 項目 | 內容 |
| --- | --- |
| 費用 | 免費；註冊頁（`supabase.com/dashboard/sign-up`）僅 GitHub / ChatGPT / SSO / Email，**無付款欄位** |
| Auth | 50,000 MAU |
| Database | 500 MB / 專案 |
| Storage | 1 GB（本練習備案，主要用 Vercel Blob） |
| Egress | 5 GB |
| 專案數 | 2 個 active（paused 不計入） |
| 超額行為 | **限制服務，不自動收費**。磁碟達 95% 轉 read-only；Fair Use 限制可能暫停專案、轉 read-only 或 API 回 402。配額於下個計費週期重置後解除 |

來源：[Pricing](https://supabase.com/pricing)、[Database and Disk Size](https://supabase.com/docs/guides/platform/database-size)、[Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)

---

## 4. 未採用的方案

### 硬性排除

| 平台 | 原因 | 原文證據 |
| --- | --- | --- |
| **AWS Amplify** | 帳號模式本身不符條件 | 新帳號 Free plan 給 $100 credits，「The account closes on its own **6 months** after you open it or when your credits run out, whichever comes first.」→ 練習明令不得把限時試用 credit 當成免費方案，且帳號會自行關閉 |

### 可行但不優先

| 平台 | 狀況 | 原文證據 |
| --- | --- | --- |
| **Firebase** | runtime 與 object storage 需綁定付款方式 | Spark 方案對 Cloud Functions、Cloud Storage、App Hosting 全部標示 "Not applicable"，必須升級 **Blaze**（需綁定 billing account）。Blaze 有 no-cost quota，但**超額自動計費**，pricing 頁未提供硬性支出上限 → 不符「優先選不用綁付款方式，或能設定硬性用量上限」 |
| **Cloudflare** | 五步可在免費完成，**但需搭配外接 storage** | Workers（100K req/日，超額回 Error 1027）、D1（5 GB）、static assets 皆免費且硬停，條件乾淨。**R2 需完成 checkout flow 加購 subscription**，而計費文件寫明「a primary payment method is required to purchase Cloudflare products and services」。不過 Step 5 改用 Supabase Storage（免費、不需綁卡）即可繞過 R2，因此 Cloudflare **並未在條件二出局**，是在條件三（學習體驗）落後 |

來源：[AWS Free Tier](https://aws.amazon.com/free/)、[Firebase Pricing](https://firebase.google.com/pricing)、[Cloudflare Billing Profile](https://developers.cloudflare.com/billing/get-started/create-billing-profile/)、[R2 Get started](https://developers.cloudflare.com/r2/get-started/)、[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

### 選擇 Vercel + Supabase 的理由

**先說清楚：Cloudflare + Supabase 同樣能在完全免費、不綁付款方式的條件下走完五步。**
兩者的差距在條件三（學習體驗），不在條件一或二。選 Vercel 的理由：

1. **五個角色全部免費，兩家註冊皆不需綁付款方式，超額是硬停而非帳單。** Vercel 明文不收取
   Blob 超額費用；Supabase 以 read-only / 402 限制服務。初學練習被擋住遠優於被扣款。
2. **部署與本機開發路徑對前端工程師最短。** `git push` 即部署，不需額外的 CLI 設定檔；
   Cloudflare 需要 `wrangler.toml` 與 binding 設定，對第一個專案是與架構無關的額外步驟。
3. **Function 執行限制較寬鬆。** Vercel Hobby 的 function 最長 300s；Cloudflare Workers 免費方案
   為每請求 **10 ms CPU time**。本練習的操作都很輕量，兩者應該都夠，但前者犯錯空間較大。
4. **有官方入門路徑**：Vercel Marketplace 頁面列出 `vercel/next.js` 的 Supabase Starter
   （Next.js App Router + cookie-based auth），直接對應 Step 3。

> [!NOTE]
> ⚠️ **判斷（非文件證據）**：以下兩點來自經驗推測，未經官方文件確認，依賴前請自行驗證。
> - 管理介面可見性：Supabase dashboard 的 auth user 清單與 table editor、Vercel dashboard 的
>   runtime log 與 Blob store，應能滿足條件三「直接看見 auth user、DB record、runtime log 與
>   storage object」。Step 2 起實地確認。
> - 條件三的其餘評分（文件完整度、錯誤訊息品質）尚未實地比較。

> [!CAUTION]
> **已修正的錯誤判斷（2026-11-17）**：本檔初版曾記載「Cloudflare Workers 是 V8 isolate，沒有
> `fs` / `net`、不能用傳統 DB driver」，並以此作為排除理由。此說法**已過期**：依
> [Workers Node.js 相容性文件](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)，
> `node:fs` 與 `node:net` 均列為支援（🟢），且 compatibility date 在 `2026-08-04` 之後，
> Node.js 相容性**預設開啟**，不再需要 `nodejs_compat` flag。保留此段以記錄決策依據的變更。
>
> 同時修正：初版稱 Vercel + Supabase 是「唯一一組」符合條件的組合，此說法不成立 ——
> Cloudflare + Supabase 同樣符合條件一與條件二。

> [!NOTE]
> 若日後想練 edge runtime，Cloudflare 是很合理的第二輪選擇。

---

## 5. 已知風險與操作注意事項

| 風險 | 影響 | 處置 |
| --- | --- | --- |
| **Supabase 免費專案閒置一週會暫停** | 五步分批進行時極可能發生 | Dashboard → 選專案 → **Resume project**，資料與設定原樣回來。暫停後 **1 年內**都可恢復。打開 dashboard 看一眼即算活動。來源：[Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) |
| **Vercel runtime log 僅保留 1 小時** | Step 4、5 要從 log 找驗證證據 | 驗證與部署安排在同一個工作階段，當場查看 |
| Vercel Hobby 限個人、非商業用途（ToS §4，已確認） | 本練習為個人學習，符合 | 日後若把成果轉為商業用途需升級方案。原文見 §3 |
| **Hobby 方案的內容可能被用於訓練 AI**（ToS 查閱時發現）| 本練習無敏感資料，不影響 | ToS 原文：「if you are on a Hobby plan or trial Pro plan, you agree that we may use Your Content to train our artificial intelligence (“AI”) and machine learning models, and we may share Your Content with third parties」。日後放真實資料前需重新評估 |
| Supabase 磁碟達 95% 轉 read-only | 本練習資料量極小，不太可能觸發 | — |
| Supabase 恢復期限文件不一致 | 2024 年 changelog 寫 90 天，現行文件寫 1 年 | 以現行文件為準；此數字會變動，未來若需依賴先重新查證 |
| Marketplace $0 方案是否需綁卡**仍未確認** | 本練習不採用該路徑，不影響 | 2026-11-17 已查 [Add a Native Integration](https://vercel.com/docs/integrations/install-an-integration/product-integration)：只寫「Native Integrations are available on all plans」與安裝流程中「select a pricing plan option」，**全頁未提付款方式**。官方文件無正面答案，維持未確認 |

### 關於 Marketplace 路徑（已評估，未採用）

`vercel.com/marketplace/supabase` 顯示 Supabase 為 native integration，「Plans starting at $0」，
可用 `vc i supabase` 安裝，並自動同步 env var、由 Vercel 統一開立發票（「Handle your invoices via
Vercel instead of Supabase」）。優點是只需一個帳號。

**未採用的原因**：自動注入 env var 會把 backing service 的接線過程藏起來，而這正是本練習要看見的
部分。此外該路徑的 $0 方案是否仍需綁定付款方式，官方頁面未說明。

---

## 6. Step 5 的 object storage 選擇

**決定：Step 5 使用 Vercel Blob，而非 Supabase Storage。**

理由：

1. **object storage 這個角色留在主平台上**，符合「主平台缺少角色時才外接」的原則。
2. **授權判斷必然落在 runtime 裡。** auth 在 Supabase、storage 在 Vercel，兩者沒有內建的信任
   關係，因此 backend 必須親手驗證 session 後才放行上傳 —— 這正是 Step 5 要求的「權限由
   backend 或 storage access rules 強制執行」，且是前者（親手寫）而非後者（宣告式規則）。
3. **超額行為已確認為明文不收費**（見 §3）。

**備案：Supabase Storage + RLS policy。** 若 Blob 遇到阻礙可改用。代價是授權判斷交給宣告式規則，
看不到 backend 驗證 session 的動作；好處是 auth 與 storage 同一家，設定較單純。

> [!NOTE]
> **本節刻意不記錄具體上傳流程。** 依 Step 1 指示，本步驟不繪製架構圖；且 Step 5 的練習方式是
> 「由自己先畫新版資料流，再請 agent 訂正」，預先寫好流程會讓該步驟失去意義。
>
> Step 5 開始時，請依 **Vercel Blob 當下的官方文件**確認建議的上傳方式，再據以繪製資料流。
> 已知必須成立的約束：`BLOB_READ_WRITE_TOKEN` 不得出現在前端程式碼；作者 ID 必須取自 backend
> 驗證過的 session，不得取自前端送來的值。

**Step 5 要驗證的失敗路徑**（來自練習要求）：未登入上傳、超過大小限制、超過類型限制、上傳成功
但 DB 寫入失敗（確認不會留下指向不存在圖片的留言），以及刪除留言時是否一併刪除圖片。

---

## 7. 目前進度

| 項目 | 狀態 |
| --- | --- |
| 目前步驟 | **Step 1 完成** |
| 已建立的帳號 | 無 |
| 已建立的專案 | 無 |
| 已部署的網址 | 無 |
| 實際程式碼 | 無（repo 僅有 `README.md` 與本檔） |

### 本步驟已執行的驗證

- 四平台免費方案逐一查閱官方文件（2026-11-16 / 11-17），證據記於 §3、§4
- Vercel 與 Supabase 註冊頁實地確認無付款欄位
- Supabase 暫停與恢復機制確認（1 週閒置暫停、1 年內可恢復）
- **（2026-11-17 補）** Vercel Hobby「限個人、非商業用途」已在 Terms of Service §4 確認原文，
  §3 與 §5 原本不一致（§3 標未確認、§5 當成事實）之處已消除
- **（2026-11-17 補）** 再查 Marketplace native integration 安裝文件，仍無付款方式的敘述，
  維持未確認
- **（2026-11-17 補）** 對照參考文章 Step 1 原始 prompt 的五點要求逐項核對：四平台比較、
  排除付費方案並標示風險、學習體驗比較、推薦後等確認才建檔、不建專案／不部署／不畫架構圖、
  只記 env 名稱 —— 皆已滿足

### 未解問題

1. Vercel Marketplace $0 方案是否需綁定付款方式 —— 2026-11-17 再查仍無文件佐證（見 §5），
   本練習不採用該路徑，暫不影響。
2. Step 3 是否需要 email 驗證信 —— 若需要，優先選不依賴寄信的登入方式，避免引入 email 服務
   （超出練習範圍）。待 Step 3 查閱 Supabase Auth 文件確認。
3. 前端框架尚未決定（Next.js 或純靜態 + Vercel Functions）—— Step 2 決定，需同時考量 Step 4 的
   runtime 寫法。

### 下一步

**Step 2：部署靜態留言板。** 建立只有前端、留言寫死的頁面，部署到 Vercel 免費子網域。
不加入 auth、runtime、database、object storage 或自有網域。
完成後在本檔新增**本練習的第一張 Mermaid 架構圖**（Browser → DNS → CDN / hosting）。

> Step 1 依指示不繪製架構圖；Mermaid 圖自 Step 2 起，每新增一項需求時繪製一張，不覆蓋前版。

---

## 變更紀錄

| 日期 | 步驟 | 變更 |
| --- | --- | --- |
| 2026-11-17 | Step 1 | 建立本檔。選定 Vercel Hobby + Supabase Free；硬性排除 AWS Amplify，Firebase 與 Cloudflare 列為可行但不優先，理由見 §4 |
| 2026-11-17 | Step 1 | 修正初版兩處錯誤判斷：(a) Cloudflare Workers 的 Node 相容性說法已過期；(b) 「唯一一組符合條件的組合」不成立。詳見 §4 的 CAUTION 區塊 |
| 2026-11-17 | Step 1 | 補查兩個未確認項：(a) Hobby「限個人、非商業用途」確認於 Terms of Service §4（原文已核對），§3／§5 說法統一；(b) Marketplace $0 方案綁卡與否仍查無文件，維持未確認。另對照文章 Step 1 原始 prompt 五點要求，確認產出完整 |
