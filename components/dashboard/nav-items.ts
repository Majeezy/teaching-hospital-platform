import type { RoleName } from "@prisma/client";
import {
  Building2,
  LayoutDashboard,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omit to show for every signed-in role. */
  roles?: RoleName[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/admin/departments",
    label: "Departments",
    icon: Building2,
    roles: ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"],
  },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: Stethoscope,
    roles: ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"],
  },
];

export function navItemsForRoles(roles: RoleName[]): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.some((role) => roles.includes(role)),
  );
}
