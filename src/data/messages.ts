/**
 * Step 2：寫死在程式碼裡的假留言。
 *
 * 這一版沒有 database，也沒有 runtime —— 這個陣列在 build 時就被讀取，
 * 直接變成靜態 HTML 的一部分。要改留言只能改這個檔案再重新部署。
 * Step 4 會把這裡換成從 managed DB 讀取。
 */

export type Message = {
  id: string;
  author: string;
  body: string;
  /** ISO 8601。Step 4 起改由 backend 產生 */
  createdAt: string;
};

export const messages: Message[] = [
  {
    id: "1",
    author: "Claire",
    body: "第一則留言。這些內容寫死在程式碼裡，build 的時候就被印進 HTML 了。",
    createdAt: "2026-11-18T09:00:00+08:00",
  },
  {
    id: "2",
    author: "Ada",
    body: "所以現在沒有 database，也沒有任何程式在雲端執行。瀏覽器拿到的是一份現成的檔案。",
    createdAt: "2026-11-18T09:12:00+08:00",
  },
  {
    id: "3",
    author: "Grace",
    body: "想改留言？只能改原始碼再重新部署一次。這正是下一步要解決的問題。",
    createdAt: "2026-11-18T09:30:00+08:00",
  },
];
