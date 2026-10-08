"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, type SessionUser } from "@/lib/permissions";

const updateMyProfileSchema = z.object({
  contactPhone: z.string().trim().max(40).optional(),
  emergencyContact: z.string().trim().max(200).optional(),
  bloodType: z.string().trim().max(10).optional(),
  allergies: z.array(z.string().trim().min(1)).max(50),
});

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

const patientListSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  patientProfile: {
    select: {
      dateOfBirth: true,
      contactPhone: true,
      bloodType: true,
      allergies: true,
    },
  },
} as const;

// Business logic takes the resolved user as a parameter -- same testable
// pattern as every other action module in this app.

export async function listPatientsForUser(user: SessionUser) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  return prisma.user.findMany({
    where: { roles: { some: { role: { name: "PATIENT" } } } },
    orderBy: { createdAt: "desc" },
    select: patientListSelect,
  });
}

export async function getMyProfileForUser(user: SessionUser) {
  requireRole(user, "PATIENT");
  return prisma.patientProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
}

export async function updateMyProfileForUser(
  user: SessionUser,
  input: UpdateMyProfileInput,
) {
  requireRole(user, "PATIENT");
  const data = updateMyProfileSchema.parse(input);

  return prisma.patientProfile.update({
    where: { userId: user.id },
    data: {
      contactPhone: data.contactPhone || null,
      emergencyContact: data.emergencyContact || null,
      bloodType: data.bloodType || null,
      allergies: data.allergies,
    },
  });
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listPatients() {
  const user = await requireUser();
  return listPatientsForUser(user);
}

export async function getMyProfile() {
  const user = await requireUser();
  return getMyProfileForUser(user);
}

export async function updateMyProfile(input: UpdateMyProfileInput) {
  const user = await requireUser();
  return updateMyProfileForUser(user, input);
}
