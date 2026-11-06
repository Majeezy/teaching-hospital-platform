"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, type SessionUser } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";

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

/**
 * Phase 6 Stage 6 "export" half of data-subject tooling. One query
 * anchored on the caller's own `userId` -- unlike the cross-role
 * appointment/clinical-record readers elsewhere in this app, there's no
 * extra scoping logic needed here, since every nested relation (notes,
 * diagnoses, prescriptions, test orders, documents) is itself reached
 * only through this patient's own `PatientProfile`.
 */
export async function exportMyDataForUser(user: SessionUser) {
  requireRole(user, "PATIENT");

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      patientProfile: {
        select: {
          dateOfBirth: true,
          contactPhone: true,
          emergencyContact: true,
          bloodType: true,
          allergies: true,
          appointments: {
            select: {
              id: true,
              scheduledAt: true,
              status: true,
              reason: true,
              doctor: { select: { user: { select: { name: true } } } },
              department: { select: { name: true } },
            },
            orderBy: { scheduledAt: "desc" },
          },
          clinicalNotes: {
            select: { id: true, content: true, createdAt: true },
          },
          diagnoses: {
            select: {
              id: true,
              description: true,
              icdCode: true,
              createdAt: true,
            },
          },
          prescriptions: {
            select: {
              id: true,
              medication: true,
              dosage: true,
              instructions: true,
              createdAt: true,
            },
          },
          testOrders: {
            select: {
              id: true,
              testType: true,
              status: true,
              orderedAt: true,
              result: {
                select: { result: true, resultedAt: true },
              },
            },
          },
          documents: {
            select: {
              id: true,
              fileName: true,
              type: true,
              sizeBytes: true,
              uploadedAt: true,
            },
          },
        },
      },
      sentMessages: {
        select: {
          id: true,
          subject: true,
          body: true,
          sentAt: true,
          recipient: { select: { name: true } },
        },
      },
      receivedMessages: {
        select: {
          id: true,
          subject: true,
          body: true,
          sentAt: true,
          sender: { select: { name: true } },
        },
      },
      notifications: {
        select: { id: true, type: true, title: true, body: true, createdAt: true },
      },
    },
  });
}

/**
 * Phase 6 Stage 6 "delete" half -- anonymize-and-deactivate, not a hard
 * delete. A patient's clinical records (appointments, diagnoses,
 * prescriptions, etc.) have no cascade back from `PatientProfile`/`User`
 * by design (same reasoning as `AuditLog.actorId` never cascading), so a
 * real erase would require deleting that whole history too -- which
 * mirrors real-world medical-record retention law closely enough that
 * it's not something a self-service button should do silently. Scrubs
 * the account's own identifying fields instead and deactivates it; the
 * clinical history stays, now detached from any reachable PII.
 */
export async function deleteMyDataForUser(user: SessionUser) {
  requireRole(user, "PATIENT");

  // Email is unique -- `user.id` (a cuid) guarantees this stays unique
  // without needing a collision check.
  const anonymizedEmail = `deleted-${user.id}@deleted.teachinghospital.test`;
  const randomPasswordHash = await hashPassword(generateTemporaryPassword());

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: "Deleted Patient",
      email: anonymizedEmail,
      passwordHash: randomPasswordHash,
      isActive: false,
      patientProfile: {
        update: {
          contactPhone: null,
          emergencyContact: null,
          bloodType: null,
          allergies: [],
        },
      },
    },
  });

  await audit({
    actorId: user.id,
    action: "DELETED_OWN_DATA",
    entityType: "User",
    entityId: user.id,
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

export async function exportMyData() {
  const user = await requireUser();
  return exportMyDataForUser(user);
}

export async function deleteMyData() {
  const user = await requireUser();
  return deleteMyDataForUser(user);
}
