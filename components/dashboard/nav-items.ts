import type { RoleName } from "@prisma/client";
import {
  Building2,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  Route,
  Stethoscope,
  User,
  UserRound,
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
  { href: "/appointments", label: "Appointments", icon: Calendar },
  {
    href: "/placements",
    label: "Placements",
    icon: Route,
    roles: ["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "DOCTOR", "STUDENT"],
  },
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
  {
    href: "/admin/patients",
    label: "Patients",
    icon: UserRound,
    roles: ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"],
  },
  {
    href: "/admin/students",
    label: "Students",
    icon: GraduationCap,
    roles: ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"],
  },
  {
    href: "/patient/profile",
    label: "My Profile",
    icon: User,
    roles: ["PATIENT"],
  },
];

export function navItemsForRoles(roles: RoleName[]): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.some((role) => roles.includes(role)),
  );
}
