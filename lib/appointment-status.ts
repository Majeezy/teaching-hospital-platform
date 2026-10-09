import type { AppointmentStatus } from "@prisma/client";

export const STATUS_VARIANT: Record<
  AppointmentStatus,
  "secondary" | "default" | "destructive" | "outline"
> = {
  SCHEDULED: "outline",
  CONFIRMED: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};
