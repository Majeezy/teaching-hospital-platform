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
    <aside className="hidden w-60 shrink-0 border-r bg-zinc-50 dark:bg-zinc-950 md:flex md:flex-col">
      <div className="px-4 py-5 text-sm font-semibold">
        Teaching Hospital
      </div>
      <NavLinks roles={roles} unreadMessageCount={unreadMessageCount} />
    </aside>
  );
}
