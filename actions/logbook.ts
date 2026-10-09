"use server";

import { prisma } from "@/lib/prisma";
import {
  requireUser,
  hasRole,
  hasAnyRole,
  AuthorizationError,
  type SessionUser,
} from "@/lib/permissions";

const logbookInclude = {
  student: { include: { user: { select: { name: true } } } },
  relatedAppointment: {
    select: {
      scheduledAt: true,
      reason: true,
      doctor: { select: { user: { select: { name: true } } } },
    },
  },
} as const;

/**
 * There is no create/update entry point in this file on purpose -- every
 * ClinicalLogbookEntry is generated automatically when a shadowed
 * appointment completes (see updateAppointmentStatusForUser in
 * actions/appointments.ts). This module is read-only.
 */
export async function listLogbookEntriesForUser(user: SessionUser) {
  if (hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"])) {
    return prisma.clinicalLogbookEntry.findMany({
      orderBy: { loggedAt: "desc" },
      include: logbookInclude,
    });
  }

  if (hasRole(user, "DOCTOR")) {
    const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.clinicalLogbookEntry.findMany({
      where: { relatedAppointment: { doctorId: doctorProfile.id } },
      orderBy: { loggedAt: "desc" },
      include: logbookInclude,
    });
  }

  if (hasRole(user, "STUDENT")) {
    const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.clinicalLogbookEntry.findMany({
      where: { studentId: studentProfile.id },
      orderBy: { loggedAt: "desc" },
      include: logbookInclude,
    });
  }

  throw new AuthorizationError(
    "Your role does not have access to the clinical logbook.",
  );
}

// Thin wrapper -- the actual "use server" entry point called from the UI.

export async function listLogbookEntries() {
  const user = await requireUser();
  return listLogbookEntriesForUser(user);
}
