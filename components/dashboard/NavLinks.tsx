"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RoleName } from "@prisma/client";
import { navItemsForRoles } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils";

export function NavLinks({
  roles,
  unreadMessageCount,
  onNavigate,
}: {
  roles: RoleName[];
  unreadMessageCount: number;
  /** Called after a link is clicked -- lets the mobile drawer close itself. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navItemsForRoles(roles);

  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon size={16} />
            {item.label}
            {item.href === "/messages" && unreadMessageCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
                {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
