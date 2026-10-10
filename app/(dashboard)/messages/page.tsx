import { Suspense } from "react";
import Link from "next/link";
import { Inbox, Send } from "lucide-react";
import {
  listEligibleRecipients,
  listInbox,
  listSent,
} from "@/actions/messages";
import { InboxList } from "@/components/messages/InboxList";
import { SentList } from "@/components/messages/SentList";
import { ComposeMessageDialog } from "@/components/messages/ComposeMessageDialog";
import { cn } from "cn";

export default function MessagesPage(props: PageProps<"/messages">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <MessagesContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function MessagesContent({
  searchParams,
}: Pick<PageProps<"/messages">, "searchParams">) {
  const params = await searchParams;
  const tab = params.tab === "sent" ? "sent" : "inbox";

  const [recipients, inbox, sent] = await Promise.all([
    listEligibleRecipients(),
    listInbox(),
    listSent(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Messages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only people you have an existing relationship with -- your own
            doctor(s), your own supervisor(s), or fellow staff -- appear as
            recipients.
          </p>
        </div>
        <ComposeMessageDialog recipients={recipients} />
      </div>

      <div className="flex gap-1 border-b">
        <Link
          href="/messages?tab=inbox"
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium",
            tab === "inbox"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Inbox size={14} />
          Inbox
          {inbox.some((m) => !m.readAt) && (
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          )}
        </Link>
        <Link
          href="/messages?tab=sent"
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium",
            tab === "sent"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Send size={14} />
          Sent
        </Link>
      </div>

      {tab === "inbox" ? <InboxList messages={inbox} /> : <SentList messages={sent} />}
    </div>
  );
}
