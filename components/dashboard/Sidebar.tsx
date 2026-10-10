import type { RoleName } from "@prisma/client";
import { NavLinks } from "@/components/dashboard/NavLinks";

export function Sidebar({
  roles,
  unreadMessageCount,
}: {
  roles: RoleName[];
  unreadMessageCount: number;
}) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="px-4 py-5 font-heading text-sm font-semibold text-sidebar-primary">
        Teaching Hospital
      </div>
      <NavLinks roles={roles} unreadMessageCount={unreadMessageCount} />
    </aside>
  );
}
