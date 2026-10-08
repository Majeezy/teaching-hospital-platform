"use client";

import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { RoleName } from "@prisma/client";

export function Topbar({
  name,
  roles,
}: {
  name: string;
  roles: RoleName[];
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {roles.map((role) => (
          <Badge key={role} variant="secondary" className="text-xs">
            {role.replace("_", " ")}
          </Badge>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 text-sm font-medium outline-none">
          <UserCircle size={20} />
          {name}
          <ChevronDown size={14} className="text-zinc-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut size={14} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
