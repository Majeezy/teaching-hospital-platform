"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireRole,
  hasRole,
  hasAnyRole,
  AuthorizationError,
  type SessionUser,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";

const createPlacementSchema = z.object({
  studentId: z.string().min(1, "Select a student"),
  departmentId: z.string().min(1, "Select a department"),
  supervisorId: z.string().min(1, "Select a supervisor"),
  startDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid start date"),
  endDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid end date"),
});

export type CreatePlacementInput = z.infer<typeof createPlacementSchema>;

const placementInclude = {
  student: {
    select: { user: { select: { name: true } }, studentNumber: true },
  },
  department: { select: { name: true } },
  supervisor: {
    select: { user: { select: { name: true } }, specialization: true },
  },
} as const;

// Placements are administratively scheduled, not self-assigned -- the
// permissions matrix gives HospitalAdmin "Full" and Supervisor only
// "Scoped" (read) access, unlike entities where staff can write their own
// scoped records. Read access is scoped per role; only admin can create.

export async function listPlacementsForUser(user: SessionUser) {
  if (hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"])) {
    return prisma.studentPlacement.findMany({
      orderBy: { startDate: "desc" },
      include: placementInclude,
    });
  }

  if (hasRole(user, "DOCTOR")) {
    const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.studentPlacement.findMany({
      where: { supervisorId: doctorProfile.id },
      orderBy: { startDate: "desc" },
      include: placementInclude,
    });
  }

  if (hasRole(user, "STUDENT")) {
    const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.studentPlacement.findMany({
      where: { studentId: studentProfile.id },
      orderBy: { startDate: "desc" },
      include: placementInclude,
    });
  }

  throw new AuthorizationError("Your role does not have access to placements.");
}

export async function listStudentsForPlacementForUser(user: SessionUser) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  return prisma.studentProfile.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
}

export async function listSupervisorsForUser(user: SessionUser) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  return prisma.doctorProfile.findMany({
    where: { canSupervise: true },
    include: {
      user: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
}

export async function createPlacementForUser(
  user: SessionUser,
  input: CreatePlacementInput,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  const data = createPlacementSchema.parse(input);

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (endDate <= startDate) {
    throw new Error("End date must be after the start date.");
  }

  // Re-validated server-side even though the UI only lists eligible
  // supervisors -- never trust that the client only submits what it was
  // shown.
  const supervisor = await prisma.doctorProfile.findUniqueOrThrow({
    where: { id: data.supervisorId },
  });
  if (!supervisor.canSupervise) {
    throw new Error(
      "This doctor is not marked as able to supervise students.",
    );
  }

  const placement = await prisma.studentPlacement.create({
    data: {
      studentId: data.studentId,
      departmentId: data.departmentId,
      supervisorId: data.supervisorId,
      startDate,
      endDate,
    },
  });

  await audit({
    actorId: user.id,
    action: "CREATED_STUDENT_PLACEMENT",
    entityType: "StudentPlacement",
    entityId: placement.id,
  });

  return placement;
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listPlacements() {
  const user = await requireUser();
  return listPlacementsForUser(user);
}

export async function listStudentsForPlacement() {
  const user = await requireUser();
  return listStudentsForPlacementForUser(user);
}

export async function listSupervisors() {
  const user = await requireUser();
  return listSupervisorsForUser(user);
}

export async function createPlacement(input: CreatePlacementInput) {
  const user = await requireUser();
  return createPlacementForUser(user, input);
}
