import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/permissions";
import {
  getUnreadNotificationCount,
  listNotifications,
} from "@/actions/notifications";
import { getUnreadMessageCount } from "@/actions/messages";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";

// This segment redirects unauthenticated requests and renders per-user
// content -- there's no meaningful static shell for Cache Components to
// validate here. `instant = false` is an honest declaration of that, not
// a migration crutch: see docs/architecture.md and Next's own
// migrating-to-cache-components guide (its own example is this exact file).
export const instant = false;

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}

async function DashboardShell({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [notifications, unreadCount, unreadMessageCount] = await Promise.all([
    listNotifications(),
    getUnreadNotificationCount(),
    getUnreadMessageCount(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar roles={user.roles} unreadMessageCount={unreadMessageCount} />
      <div className="flex flex-1 flex-col">
        <Topbar
          name={user.name}
          roles={user.roles}
          notifications={notifications}
          unreadCount={unreadCount}
        />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
