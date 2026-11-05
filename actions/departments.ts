"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, type SessionUser } from "@/lib/permissions";
import { audit } from "@/lib/audit";

const departmentSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  description: z.string().trim().optional(),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;

// Business logic takes the resolved user as a parameter -- same testable
// pattern as actions/users.ts.

export async function listDepartmentsForUser(user: SessionUser) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  return prisma.department.findMany({ orderBy: { name: "asc" } });
}

export async function createDepartmentForUser(
  user: SessionUser,
  input: DepartmentInput,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  const data = departmentSchema.parse(input);

  const department = await prisma.department.create({ data });

  await audit({
    actorId: user.id,
    action: "CREATED_DEPARTMENT",
    entityType: "Department",
    entityId: department.id,
    metadata: { name: department.name },
  });

  return department;
}

export async function updateDepartmentForUser(
  user: SessionUser,
  departmentId: string,
  input: DepartmentInput,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  const data = departmentSchema.parse(input);

  const department = await prisma.department.update({
    where: { id: departmentId },
    data,
  });

  await audit({
    actorId: user.id,
    action: "UPDATED_DEPARTMENT",
    entityType: "Department",
    entityId: department.id,
    metadata: { name: department.name },
  });

  return department;
}

export async function deleteDepartmentForUser(
  user: SessionUser,
  departmentId: string,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");

  let department;
  try {
    department = await prisma.department.delete({
      where: { id: departmentId },
    });
  } catch (error) {
    // P2003: foreign key constraint violation -- staff, appointments, or
    // placements still reference this department. Surfaced as a friendly
    // message instead of the raw Prisma error the UI's toast would
    // otherwise show verbatim.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new Error(
        "This department still has staff, appointments, or placements assigned to it. Reassign or remove them first.",
      );
    }
    throw error;
  }

  await audit({
    actorId: user.id,
    action: "DELETED_DEPARTMENT",
    entityType: "Department",
    entityId: departmentId,
    metadata: { name: department.name },
  });

  return department;
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listDepartments() {
  const user = await requireUser();
  return listDepartmentsForUser(user);
}

export async function createDepartment(input: DepartmentInput) {
  const user = await requireUser();
  return createDepartmentForUser(user, input);
}

export async function updateDepartment(
  departmentId: string,
  input: DepartmentInput,
) {
  const user = await requireUser();
  return updateDepartmentForUser(user, departmentId, input);
}

export async function deleteDepartment(departmentId: string) {
  const user = await requireUser();
  return deleteDepartmentForUser(user, departmentId);
}
