import type { AppointmentStatus } from "@prisma/client";

export const STATUS_VARIANT: Record<
  AppointmentStatus,
  "secondary" | "default" | "destructive" | "outline" | "success"
> = {
  SCHEDULED: "outline",
  CONFIRMED: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "success",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};
