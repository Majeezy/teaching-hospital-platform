import { prisma } from "@/lib/prisma";

/**
 * Mirrors lib/audit.ts's audit() -- a single, deliberately dumb helper
 * called from inside the action that causes the event, rather than a
 * generic event-bus/pub-sub layer. There's no email delivery: no email
 * provider has been chosen anywhere in this project (the same reason
 * Document file uploads stayed deferred in Phase 1 Stage 5), so a
 * notification is an in-app row only.
 */
export async function notify(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
    },
  });
}
