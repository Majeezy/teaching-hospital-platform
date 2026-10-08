"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireUser, requireRole, type SessionUser } from "@/lib/permissions";
import { audit } from "@/lib/audit";

const createDoctorSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  departmentId: z.string().min(1, "Select a department"),
  specialization: z.string().trim().min(2, "Specialization is required"),
  licenseNumber: z.string().trim().min(2, "License number is required"),
  canSupervise: z.boolean(),
});

const createNurseSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  departmentId: z.string().min(1, "Select a department"),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type CreateNurseInput = z.infer<typeof createNurseSchema>;

const staffListSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  roles: { select: { role: { select: { name: true } } } },
  doctorProfile: {
    select: {
      department: { select: { name: true } },
      specialization: true,
      licenseNumber: true,
      canSupervise: true,
    },
  },
  nurseProfile: { select: { department: { select: { name: true } } } },
} as const;

export async function listStaffForUser(user: SessionUser) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  return prisma.user.findMany({
    where: { roles: { some: { role: { name: { in: ["DOCTOR", "NURSE"] } } } } },
    orderBy: { createdAt: "desc" },
    select: staffListSelect,
  });
}

export async function createDoctorForUser(
  user: SessionUser,
  input: CreateDoctorInput,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  const data = createDoctorSchema.parse(input);

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const doctorRole = await prisma.role.findUniqueOrThrow({
    where: { name: "DOCTOR" },
  });
  const passwordHash = await hashPassword(data.password);

  const created = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      roles: { create: { roleId: doctorRole.id } },
      doctorProfile: {
        create: {
          departmentId: data.departmentId,
          specialization: data.specialization,
          licenseNumber: data.licenseNumber,
          canSupervise: data.canSupervise,
        },
      },
    },
  });

  await audit({
    actorId: user.id,
    action: "CREATED_DOCTOR_ACCOUNT",
    entityType: "User",
    entityId: created.id,
    metadata: { email: created.email },
  });

  return created;
}

export async function createNurseForUser(
  user: SessionUser,
  input: CreateNurseInput,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  const data = createNurseSchema.parse(input);

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const nurseRole = await prisma.role.findUniqueOrThrow({
    where: { name: "NURSE" },
  });
  const passwordHash = await hashPassword(data.password);

  const created = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      roles: { create: { roleId: nurseRole.id } },
      nurseProfile: { create: { departmentId: data.departmentId } },
    },
  });

  await audit({
    actorId: user.id,
    action: "CREATED_NURSE_ACCOUNT",
    entityType: "User",
    entityId: created.id,
    metadata: { email: created.email },
  });

  return created;
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listStaff() {
  const user = await requireUser();
  return listStaffForUser(user);
}

export async function createDoctor(input: CreateDoctorInput) {
  const user = await requireUser();
  return createDoctorForUser(user, input);
}

export async function createNurse(input: CreateNurseInput) {
  const user = await requireUser();
  return createNurseForUser(user, input);
}
