"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/permissions";

export async function listNotificationsForUser(user: SessionUser) {
  return prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getUnreadNotificationCountForUser(user: SessionUser) {
  return prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });
}

export async function markNotificationReadForUser(
  user: SessionUser,
  notificationId: string,
) {
  // updateMany (not update) scoped to this user's own id -- marking
  // someone else's notification read should fail silently as a no-op,
  // not leak whether that notification id exists at all.
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { isRead: true },
  });
}

export async function markAllNotificationsReadForUser(user: SessionUser) {
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listNotifications() {
  const user = await requireUser();
  return listNotificationsForUser(user);
}

export async function getUnreadNotificationCount() {
  const user = await requireUser();
  return getUnreadNotificationCountForUser(user);
}

export async function markNotificationRead(notificationId: string) {
  const user = await requireUser();
  return markNotificationReadForUser(user, notificationId);
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  return markAllNotificationsReadForUser(user);
}
