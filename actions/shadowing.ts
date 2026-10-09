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
import { notify } from "@/lib/notifications";
import { getAppointmentForUser, isAssignedDoctor } from "@/actions/appointments";

const assignShadowingSchema = z.object({
  appointmentId: z.string().min(1),
  studentId: z.string().min(1, "Select a student"),
});

export type AssignShadowingInput = z.infer<typeof assignShadowingSchema>;

/**
 * Confirms the caller is allowed to manage shadowing for this specific
 * appointment: a supervising doctor (canSupervise = true) who is also the
 * assigned doctor. Shared by both the "who can I assign" list and the
 * actual assignment, so the two can never disagree about eligibility.
 */
async function assertCanManageShadowing(
  user: SessionUser,
  appointmentId: string,
) {
  requireRole(user, "DOCTOR");
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
  });
  const owns = await isAssignedDoctor(user, appointment.doctorId);
  if (!owns) {
    throw new AuthorizationError(
      "You can only assign shadowing for your own appointments.",
    );
  }

  const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  if (!doctorProfile.canSupervise) {
    throw new AuthorizationError(
      "You are not marked as able to supervise students.",
    );
  }

  return { appointment, doctorProfile };
}

export async function listShadowableStudentsForUser(
  user: SessionUser,
  appointmentId: string,
) {
  const { doctorProfile } = await assertCanManageShadowing(
    user,
    appointmentId,
  );

  // Only students with an active placement under this specific
  // supervisor -- not every student in the system, and not students
  // supervised by a different doctor.
  const placements = await prisma.studentPlacement.findMany({
    where: { supervisorId: doctorProfile.id, status: "ACTIVE" },
    include: { student: { include: { user: { select: { name: true } } } } },
  });

  return placements.map((placement) => placement.student);
}

export async function listShadowingForAppointmentForUser(
  user: SessionUser,
  appointmentId: string,
) {
  // Reuses the appointment's own access rule -- knowing which students
  // are observing isn't itself sensitive clinical data.
  await getAppointmentForUser(user, appointmentId);

  return prisma.shadowingAssignment.findMany({
    where: { appointmentId },
    include: { student: { include: { user: { select: { name: true } } } } },
  });
}

export async function assignShadowingForUser(
  user: SessionUser,
  input: AssignShadowingInput,
) {
  const data = assignShadowingSchema.parse(input);
  const { appointment } = await assertCanManageShadowing(
    user,
    data.appointmentId,
  );

  if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    throw new Error(
      "Cannot assign shadowing to a cancelled or no-show appointment.",
    );
  }

  const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const placement = await prisma.studentPlacement.findFirst({
    where: {
      studentId: data.studentId,
      supervisorId: doctorProfile.id,
      status: "ACTIVE",
    },
    include: { student: { select: { userId: true } } },
  });
  if (!placement) {
    throw new Error("This student does not have an active placement under you.");
  }

  const existing = await prisma.shadowingAssignment.findUnique({
    where: {
      appointmentId_studentId: {
        appointmentId: data.appointmentId,
        studentId: data.studentId,
      },
    },
  });
  if (existing) {
    throw new Error("This student is already assigned to shadow this appointment.");
  }

  const assignment = await prisma.shadowingAssignment.create({
    data: { appointmentId: data.appointmentId, studentId: data.studentId },
  });

  await audit({
    actorId: user.id,
    action: "ASSIGNED_SHADOWING",
    entityType: "ShadowingAssignment",
    entityId: assignment.id,
    metadata: { appointmentId: data.appointmentId, studentId: data.studentId },
  });

  await notify({
    userId: placement.student.userId,
    type: "SHADOWING_ASSIGNED",
    title: "New shadowing assignment",
    body: `You've been assigned to shadow an appointment on ${appointment.scheduledAt.toLocaleString()}.`,
  });

  return assignment;
}

const shadowingInclude = {
  student: { include: { user: { select: { name: true } } } },
  appointment: {
    select: {
      scheduledAt: true,
      status: true,
      patient: { select: { user: { select: { name: true } } } },
      doctor: { select: { user: { select: { name: true } } } },
    },
  },
} as const;

export async function listShadowingForUser(user: SessionUser) {
  if (hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"])) {
    return prisma.shadowingAssignment.findMany({
      orderBy: { createdAt: "desc" },
      include: shadowingInclude,
    });
  }

  if (hasRole(user, "DOCTOR")) {
    const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.shadowingAssignment.findMany({
      where: { appointment: { doctorId: doctorProfile.id } },
      orderBy: { createdAt: "desc" },
      include: shadowingInclude,
    });
  }

  if (hasRole(user, "STUDENT")) {
    const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.shadowingAssignment.findMany({
      where: { studentId: studentProfile.id },
      orderBy: { createdAt: "desc" },
      include: shadowingInclude,
    });
  }

  throw new AuthorizationError(
    "Your role does not have access to shadowing assignments.",
  );
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listShadowableStudents(appointmentId: string) {
  const user = await requireUser();
  return listShadowableStudentsForUser(user, appointmentId);
}

export async function listShadowingForAppointment(appointmentId: string) {
  const user = await requireUser();
  return listShadowingForAppointmentForUser(user, appointmentId);
}

export async function assignShadowing(input: AssignShadowingInput) {
  const user = await requireUser();
  return assignShadowingForUser(user, input);
}

export async function listShadowing() {
  const user = await requireUser();
  return listShadowingForUser(user);
}
