"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, type SessionUser } from "@/lib/permissions";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

const appointmentWithPatient = {
  patient: { select: { user: { select: { name: true } } } },
} as const;

const appointmentWithDoctor = {
  doctor: { select: { user: { select: { name: true } } } },
  department: { select: { name: true } },
} as const;

export async function getAdminDashboardForUser(user: SessionUser) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");

  const [
    totalPatients,
    totalDoctors,
    totalDepartments,
    appointmentsToday,
    pendingAppointments,
    recentActivity,
  ] = await Promise.all([
    prisma.patientProfile.count(),
    prisma.doctorProfile.count(),
    prisma.department.count(),
    prisma.appointment.count({
      where: { scheduledAt: { gte: startOfToday(), lte: endOfToday() } },
    }),
    // "Pending tasks" mapped to something real rather than invented --
    // appointments a patient has requested that nobody has confirmed yet.
    prisma.appointment.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: { ...appointmentWithPatient, ...appointmentWithDoctor },
    }),
    // Real use of the audit log built all the way back in Phase 0 --
    // this is the first UI that actually reads from it.
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  return {
    totalPatients,
    totalDoctors,
    totalDepartments,
    appointmentsToday,
    pendingAppointments,
    recentActivity,
  };
}

export async function getDoctorDashboardForUser(user: SessionUser) {
  requireRole(user, "DOCTOR");
  const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  const [todaysAppointments, upcomingAppointments, recentCompleted] =
    await Promise.all([
      prisma.appointment.findMany({
        where: {
          doctorId: doctorProfile.id,
          scheduledAt: { gte: startOfToday(), lte: endOfToday() },
        },
        orderBy: { scheduledAt: "asc" },
        include: appointmentWithPatient,
      }),
      prisma.appointment.findMany({
        where: {
          doctorId: doctorProfile.id,
          scheduledAt: { gt: endOfToday() },
          status: { notIn: ["CANCELLED"] },
        },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        include: appointmentWithPatient,
      }),
      prisma.appointment.findMany({
        where: { doctorId: doctorProfile.id, status: "COMPLETED" },
        orderBy: { scheduledAt: "desc" },
        take: 5,
        include: appointmentWithPatient,
      }),
    ]);

  return { todaysAppointments, upcomingAppointments, recentCompleted };
}

export async function getPatientDashboardForUser(user: SessionUser) {
  requireRole(user, "PATIENT");
  const patientProfile = await prisma.patientProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  const [upcomingAppointments, pastAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        patientId: patientProfile.id,
        scheduledAt: { gte: new Date() },
        status: { notIn: ["CANCELLED"] },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: appointmentWithDoctor,
    }),
    prisma.appointment.findMany({
      where: {
        patientId: patientProfile.id,
        OR: [{ scheduledAt: { lt: new Date() } }, { status: "COMPLETED" }],
      },
      orderBy: { scheduledAt: "desc" },
      take: 5,
      include: appointmentWithDoctor,
    }),
  ]);

  return { patientProfile, upcomingAppointments, pastAppointments };
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function getAdminDashboard() {
  const user = await requireUser();
  return getAdminDashboardForUser(user);
}

export async function getDoctorDashboard() {
  const user = await requireUser();
  return getDoctorDashboardForUser(user);
}

export async function getPatientDashboard() {
  const user = await requireUser();
  return getPatientDashboardForUser(user);
}
