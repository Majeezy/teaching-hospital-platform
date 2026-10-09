import type { listSentForUser } from "@/actions/messages";

type Message = Awaited<ReturnType<typeof listSentForUser>>[number];

export function SentList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-zinc-500">You haven&rsquo;t sent any messages.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {messages.map((message) => (
        <div key={message.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="font-medium">To {message.recipient.name}</span>
              {message.subject && (
                <span className="text-zinc-500"> — {message.subject}</span>
              )}
            </span>
            <span className="text-xs text-zinc-500">
              {new Date(message.sentAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{message.body}</p>
        </div>
      ))}
    </div>
  );
}
