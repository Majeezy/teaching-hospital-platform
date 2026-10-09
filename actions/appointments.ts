"use server";

import { z } from "zod";
import type { AppointmentStatus } from "@prisma/client";
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
import { notify } from "@/lib/notifications";

const requestAppointmentSchema = z.object({
  doctorId: z.string().min(1, "Select a doctor"),
  scheduledAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time"),
  reason: z.string().trim().max(500).optional(),
});

export type RequestAppointmentInput = z.infer<typeof requestAppointmentSchema>;

// Which status transitions are structurally valid, regardless of who's
// asking -- a terminal status (COMPLETED/CANCELLED/NO_SHOW) never has an
// onward transition.
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const appointmentInclude = {
  patient: { select: { user: { select: { name: true, email: true } } } },
  doctor: {
    select: {
      user: { select: { name: true } },
      specialization: true,
    },
  },
  department: { select: { name: true } },
} as const;

export async function listAppointmentsForUser(user: SessionUser) {
  if (hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"])) {
    return prisma.appointment.findMany({
      orderBy: { scheduledAt: "desc" },
      include: appointmentInclude,
    });
  }

  if (hasRole(user, "DOCTOR")) {
    const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.appointment.findMany({
      where: { doctorId: doctorProfile.id },
      orderBy: { scheduledAt: "desc" },
      include: appointmentInclude,
    });
  }

  if (hasRole(user, "NURSE")) {
    const nurseProfile = await prisma.nurseProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.appointment.findMany({
      where: { departmentId: nurseProfile.departmentId },
      orderBy: { scheduledAt: "desc" },
      include: appointmentInclude,
    });
  }

  if (hasRole(user, "PATIENT")) {
    const patientProfile = await prisma.patientProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.appointment.findMany({
      where: { patientId: patientProfile.id },
      orderBy: { scheduledAt: "desc" },
      include: appointmentInclude,
    });
  }

  if (hasRole(user, "STUDENT")) {
    const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.appointment.findMany({
      where: { shadowing: { some: { studentId: studentProfile.id } } },
      orderBy: { scheduledAt: "desc" },
      include: appointmentInclude,
    });
  }

  throw new AuthorizationError("Your role does not have access to appointments.");
}

/**
 * Single-appointment fetch with the same access rule as the list: admin
 * (oversight), the assigned doctor, a nurse in the same department, the
 * owning patient, or a student with an active shadowing assignment for
 * this appointment. Used directly by the appointment detail page, and by
 * actions/clinical-records.ts so record access follows the exact same
 * rule as appointment access, in one place, rather than reimplemented.
 *
 * `isShadowingStudent` is also returned so clinical-records.ts can scope
 * *what* a shadowing student sees (notes + diagnosis only, not
 * prescriptions/test results) -- the brief was explicit that shadowing
 * access must be scoped, not full record parity.
 */
export async function getAppointmentForUser(
  user: SessionUser,
  appointmentId: string,
) {
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: appointmentInclude,
  });

  const isAdmin = hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"]);
  const [assignedDoctor, owningPatient] = await Promise.all([
    isAssignedDoctor(user, appointment.doctorId),
    isOwningPatient(user, appointment.patientId),
  ]);

  let deptNurse = false;
  if (hasRole(user, "NURSE")) {
    const nurseProfile = await prisma.nurseProfile.findUnique({
      where: { userId: user.id },
    });
    deptNurse = nurseProfile?.departmentId === appointment.departmentId;
  }

  let isShadowingStudent = false;
  if (hasRole(user, "STUDENT")) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
    });
    if (studentProfile) {
      const assignment = await prisma.shadowingAssignment.findUnique({
        where: {
          appointmentId_studentId: {
            appointmentId: appointment.id,
            studentId: studentProfile.id,
          },
        },
      });
      isShadowingStudent = !!assignment;
    }
  }

  if (
    !isAdmin &&
    !assignedDoctor &&
    !owningPatient &&
    !deptNurse &&
    !isShadowingStudent
  ) {
    throw new AuthorizationError("You don't have access to this appointment.");
  }

  return { appointment, canEdit: assignedDoctor, isShadowingStudent };
}

export async function listDoctorsForBookingForUser(user: SessionUser) {
  requireRole(user, "PATIENT");
  return prisma.doctorProfile.findMany({
    include: {
      user: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
}

export async function requestAppointmentForUser(
  user: SessionUser,
  input: RequestAppointmentInput,
) {
  requireRole(user, "PATIENT");
  const data = requestAppointmentSchema.parse(input);

  const scheduledAt = new Date(data.scheduledAt);
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Appointment time must be in the future.");
  }

  const [patientProfile, doctor] = await Promise.all([
    prisma.patientProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    prisma.doctorProfile.findUniqueOrThrow({ where: { id: data.doctorId } }),
  ]);

  const appointment = await prisma.appointment.create({
    data: {
      patientId: patientProfile.id,
      doctorId: doctor.id,
      departmentId: doctor.departmentId,
      scheduledAt,
      reason: data.reason || null,
    },
  });

  await audit({
    actorId: user.id,
    action: "REQUESTED_APPOINTMENT",
    entityType: "Appointment",
    entityId: appointment.id,
  });

  await notify({
    userId: doctor.userId,
    type: "APPOINTMENT_REQUESTED",
    title: "New appointment request",
    body: `${user.name} requested an appointment on ${scheduledAt.toLocaleString()}.`,
  });

  return appointment;
}

export async function isAssignedDoctor(user: SessionUser, doctorId: string) {
  if (!hasRole(user, "DOCTOR")) return false;
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: user.id },
  });
  return profile?.id === doctorId;
}

export async function isOwningPatient(user: SessionUser, patientId: string) {
  if (!hasRole(user, "PATIENT")) return false;
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: user.id },
  });
  return profile?.id === patientId;
}

export async function updateAppointmentStatusForUser(
  user: SessionUser,
  appointmentId: string,
  newStatus: AppointmentStatus,
) {
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: {
      patient: { select: { userId: true } },
      doctor: { select: { userId: true } },
    },
  });

  const allowedNext = ALLOWED_TRANSITIONS[appointment.status];
  if (!allowedNext.includes(newStatus)) {
    throw new Error(
      `Cannot move an appointment from ${appointment.status} to ${newStatus}.`,
    );
  }

  const isAdmin = hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"]);

  // Tracked here, used after the transaction commits, to notify the
  // doctor only when the *patient* was the one who cancelled -- not
  // when the doctor or admin did it themselves.
  let notifyDoctorOfPatientCancellation = false;

  if (newStatus === "CANCELLED") {
    // Cancellation can come from the admin, the assigned doctor, or the
    // patient themselves -- everything else is a clinical workflow step
    // only the admin or assigned doctor should be able to drive.
    const [assignedDoctor, owningPatient] = await Promise.all([
      isAssignedDoctor(user, appointment.doctorId),
      isOwningPatient(user, appointment.patientId),
    ]);
    if (!isAdmin && !assignedDoctor && !owningPatient) {
      throw new AuthorizationError(
        "You can only cancel your own appointment.",
      );
    }
    notifyDoctorOfPatientCancellation = owningPatient;
  } else {
    const assignedDoctor = await isAssignedDoctor(user, appointment.doctorId);
    if (!isAdmin && !assignedDoctor) {
      throw new AuthorizationError(
        "Only the assigned doctor or an admin can update this appointment.",
      );
    }
  }

  // A completed appointment automatically logs clinical hours for every
  // student who shadowed it -- the brief was explicit that the logbook
  // must be "calculated from database records, not fake numbers," so
  // this is the one and only place a ClinicalLogbookEntry gets created;
  // there's no manual-entry UI. ALLOWED_TRANSITIONS has no path back out
  // of COMPLETED, so this can only run once per appointment.
  const shadowingStudents =
    newStatus === "COMPLETED"
      ? await prisma.shadowingAssignment.findMany({
          where: { appointmentId },
          select: { studentId: true },
        })
      : [];

  const [updated] = await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: newStatus },
    }),
    ...(shadowingStudents.length > 0
      ? [
          prisma.clinicalLogbookEntry.createMany({
            data: shadowingStudents.map(({ studentId }) => ({
              studentId,
              type: "OBSERVED_CONSULTATION" as const,
              relatedAppointmentId: appointmentId,
              hours: appointment.durationMinutes / 60,
            })),
          }),
        ]
      : []),
  ]);

  await audit({
    actorId: user.id,
    action: `APPOINTMENT_STATUS_${newStatus}`,
    entityType: "Appointment",
    entityId: appointmentId,
    metadata: {
      from: appointment.status,
      to: newStatus,
      loggedForStudentIds: shadowingStudents.map((s) => s.studentId),
    },
  });

  if (newStatus === "CONFIRMED" || newStatus === "CANCELLED" || newStatus === "COMPLETED") {
    await notify({
      userId: appointment.patient.userId,
      type: `APPOINTMENT_${newStatus}`,
      title: `Appointment ${newStatus.toLowerCase()}`,
      body: `Your appointment on ${appointment.scheduledAt.toLocaleString()} is now ${newStatus.toLowerCase()}.`,
    });
  }

  if (notifyDoctorOfPatientCancellation) {
    await notify({
      userId: appointment.doctor.userId,
      type: "APPOINTMENT_CANCELLED",
      title: "Appointment cancelled by patient",
      body: `The appointment on ${appointment.scheduledAt.toLocaleString()} was cancelled by the patient.`,
    });
  }

  return updated;
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listAppointments() {
  const user = await requireUser();
  return listAppointmentsForUser(user);
}

export async function getAppointment(appointmentId: string) {
  const user = await requireUser();
  return getAppointmentForUser(user, appointmentId);
}

export async function listDoctorsForBooking() {
  const user = await requireUser();
  return listDoctorsForBookingForUser(user);
}

export async function requestAppointment(input: RequestAppointmentInput) {
  const user = await requireUser();
  return requestAppointmentForUser(user, input);
}

export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: AppointmentStatus,
) {
  const user = await requireUser();
  return updateAppointmentStatusForUser(user, appointmentId, newStatus);
}
