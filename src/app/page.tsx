import { messages } from "@/data/messages";

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Taipei",
});

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-12">
      <header className="flex flex-col gap-2 border-b border-black/10 pb-6 dark:border-white/15">
        <h1 className="text-2xl font-semibold tracking-tight">最小留言板</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Step 2 · 只有前端的靜態版本。留言寫死在程式碼裡，尚未支援註冊與發言。
        </p>
      </header>

      <ul className="flex flex-col gap-4">
        {messages.map((message) => (
          <li
            key={message.id}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{message.author}</span>
              <time
                dateTime={message.createdAt}
                className="text-xs text-black/50 dark:text-white/50"
              >
                {dateFormatter.format(new Date(message.createdAt))}
              </time>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-black/80 dark:text-white/80">
              {message.body}
            </p>
          </li>
        ))}
      </ul>

      <footer className="mt-auto border-t border-black/10 pt-6 text-xs text-black/50 dark:border-white/15 dark:text-white/50">
        <p>
          這一版只用到 static hosting 與 CDN。auth、runtime、database 與 object
          storage 會在後續步驟逐一加入。
        </p>
      </footer>
    </main>
  );
}
