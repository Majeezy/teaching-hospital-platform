"use client";

import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { SearchBar } from "@/components/dashboard/SearchBar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import type { RoleName } from "@prisma/client";
import type { listNotificationsForUser } from "@/actions/notifications";

export function Topbar({
  name,
  roles,
  notifications,
  unreadCount,
  unreadMessageCount,
}: {
  name: string;
  roles: RoleName[];
  notifications: Awaited<ReturnType<typeof listNotificationsForUser>>;
  unreadCount: number;
  unreadMessageCount: number;
}) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b px-3 md:gap-4 md:px-6">
      <div className="flex items-center gap-2">
        <MobileNav roles={roles} unreadMessageCount={unreadMessageCount} />
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {roles.map((role) => (
            <Badge key={role} variant="secondary" className="text-xs">
              {role.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </div>

      <SearchBar />

      <div className="flex items-center gap-2">
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 text-sm font-medium outline-none"
            aria-label={name}
          >
            <UserCircle size={20} />
            {/* Hidden visually on narrow screens to keep the header from
                overflowing, but aria-label above keeps this trigger's
                accessible name stable either way -- a hidden span's text
                content doesn't make it into the accessibility tree. */}
            <span className="hidden sm:inline">{name}</span>
            <ChevronDown size={14} className="text-zinc-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Not DropdownMenuLabel (Base UI's Menu.GroupLabel) -- that
                requires a surrounding Menu.Group, which this isn't; using
                it bare throws "MenuGroupContext is missing" at runtime. */}
            <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
              {name}
            </p>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={14} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
