import type { LearningActivityStatus } from "@prisma/client";

export const ACTIVITY_STATUS_VARIANT: Record<
  LearningActivityStatus,
  "secondary" | "default" | "destructive" | "outline" | "success"
> = {
  ASSIGNED: "outline",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  REVIEWED: "success",
};
