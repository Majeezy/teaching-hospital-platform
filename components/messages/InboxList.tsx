"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markMessageRead, type listInboxForUser } from "@/actions/messages";

type Message = Awaited<ReturnType<typeof listInboxForUser>>[number];

export function InboxList({ messages }: { messages: Message[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(message: Message) {
    const opening = openId !== message.id;
    setOpenId(opening ? message.id : null);
    if (opening && !message.readAt) {
      startTransition(async () => {
        await markMessageRead(message.id);
        router.refresh();
      });
    }
  }

  if (messages.length === 0) {
    return <p className="text-sm text-zinc-500">Nothing in your inbox.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {messages.map((message) => (
        <div key={message.id} className="rounded-md border">
          <button
            type="button"
            onClick={() => handleToggle(message)}
            aria-expanded={openId === message.id}
            className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex items-center gap-2">
              {!message.readAt && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              )}
              <span className="font-medium">{message.sender.name}</span>
              {message.subject && (
                <span className="text-zinc-500">— {message.subject}</span>
              )}
            </span>
            <span className="text-xs text-zinc-500">
              {new Date(message.sentAt).toLocaleString()}
            </span>
          </button>
          {openId === message.id && (
            <p className="border-t px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400">
              {message.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
