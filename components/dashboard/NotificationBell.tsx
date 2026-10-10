"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsRead,
  markNotificationRead,
  type listNotificationsForUser,
} from "@/actions/notifications";

type Notification = Awaited<ReturnType<typeof listNotificationsForUser>>[number];

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleOpen(notification: Notification) {
    if (notification.isRead) return;
    startTransition(async () => {
      await markNotificationRead(notification.id);
      router.refresh();
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex items-center justify-center rounded-md p-2 text-zinc-500 outline-none hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          {/* Not DropdownMenuLabel (Base UI's Menu.GroupLabel) -- that
              requires a surrounding Menu.Group, which this isn't; using
              it bare throws "MenuGroupContext is missing" at runtime. */}
          <p className="text-xs font-medium text-muted-foreground">
            Notifications
          </p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto p-1">
          {notifications.length === 0 && (
            <p className="px-2 py-3 text-center text-sm text-zinc-500">
              No notifications yet.
            </p>
          )}
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => handleOpen(notification)}
              className="flex flex-col gap-0.5 rounded-md p-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="flex items-center gap-2 font-medium">
                {!notification.isRead && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                )}
                {notification.title}
              </span>
              <span className="text-zinc-500">{notification.body}</span>
              <span className="text-xs text-zinc-400">
                {new Date(notification.createdAt).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
