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

  throw new AuthorizationError("Your role does not have access to appointments.");
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

  return appointment;
}

async function isAssignedDoctor(user: SessionUser, doctorId: string) {
  if (!hasRole(user, "DOCTOR")) return false;
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: user.id },
  });
  return profile?.id === doctorId;
}

async function isOwningPatient(user: SessionUser, patientId: string) {
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
  });

  const allowedNext = ALLOWED_TRANSITIONS[appointment.status];
  if (!allowedNext.includes(newStatus)) {
    throw new Error(
      `Cannot move an appointment from ${appointment.status} to ${newStatus}.`,
    );
  }

  const isAdmin = hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"]);

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
  } else {
    const assignedDoctor = await isAssignedDoctor(user, appointment.doctorId);
    if (!isAdmin && !assignedDoctor) {
      throw new AuthorizationError(
        "Only the assigned doctor or an admin can update this appointment.",
      );
    }
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: newStatus },
  });

  await audit({
    actorId: user.id,
    action: `APPOINTMENT_STATUS_${newStatus}`,
    entityType: "Appointment",
    entityId: appointmentId,
    metadata: { from: appointment.status, to: newStatus },
  });

  return updated;
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listAppointments() {
  const user = await requireUser();
  return listAppointmentsForUser(user);
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
