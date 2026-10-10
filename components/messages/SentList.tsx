import type { listSentForUser } from "@/actions/messages";
import { formatDateTime } from "@/lib/format-date";

type Message = Awaited<ReturnType<typeof listSentForUser>>[number];

export function SentList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">You haven&rsquo;t sent any messages.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {messages.map((message) => (
        <div key={message.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="font-medium">To {message.recipient.name}</span>
              {message.subject && (
                <span className="text-muted-foreground"> — {message.subject}</span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(message.sentAt)}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">{message.body}</p>
        </div>
      ))}
    </div>
  );
}
