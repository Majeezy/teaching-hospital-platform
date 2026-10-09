"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RoleName } from "@prisma/client";
import { navItemsForRoles } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils";

export function Sidebar({
  roles,
  unreadMessageCount,
}: {
  roles: RoleName[];
  unreadMessageCount: number;
}) {
  const pathname = usePathname();
  const items = navItemsForRoles(roles);

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-zinc-50 dark:bg-zinc-950 md:flex md:flex-col">
      <div className="px-4 py-5 text-sm font-semibold">
        Teaching Hospital
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800",
              )}
            >
              <item.icon size={16} />
              {item.label}
              {item.href === "/messages" && unreadMessageCount > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                  {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
