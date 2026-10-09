"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, type SessionUser } from "@/lib/permissions";
import { getStudentCompetencyProgressForUser } from "@/actions/competencies";

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

  const [
    todaysAppointments,
    upcomingAppointments,
    recentCompleted,
    supervisedStudents,
    activitiesAwaitingFeedback,
  ] = await Promise.all([
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
    // "My students" section (Phase 2 Stage 6): extends this dashboard
    // rather than building a separate supervisor portal, per the plan.
    // Empty for a doctor who isn't a supervisor -- no placements can
    // exist under them anyway.
    doctorProfile.canSupervise
      ? prisma.studentPlacement.findMany({
          where: { supervisorId: doctorProfile.id, status: "ACTIVE" },
          include: { student: { include: { user: { select: { name: true } } } } },
        })
      : Promise.resolve([]),
    doctorProfile.canSupervise
      ? prisma.learningActivity.findMany({
          where: { supervisorId: doctorProfile.id, status: "COMPLETED" },
          orderBy: { completedAt: "asc" },
          take: 5,
          include: { student: { include: { user: { select: { name: true } } } } },
        })
      : Promise.resolve([]),
  ]);

  return {
    todaysAppointments,
    upcomingAppointments,
    recentCompleted,
    supervisedStudents,
    activitiesAwaitingFeedback,
  };
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

export async function getStudentDashboardForUser(user: SessionUser) {
  requireRole(user, "STUDENT");
  const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  const [
    todaysActivities,
    pendingReflectionActivities,
    upcomingShadowing,
    currentPlacement,
    hoursLogged,
    competencyProgress,
  ] = await Promise.all([
    prisma.learningActivity.findMany({
      where: {
        studentId: studentProfile.id,
        dueDate: { gte: startOfToday(), lte: endOfToday() },
      },
      orderBy: { dueDate: "asc" },
      include: { supervisor: { select: { user: { select: { name: true } } } } },
    }),
    // Activities still needing a reflection -- ASSIGNED or IN_PROGRESS,
    // i.e. not yet COMPLETED. Separate from "today's activities" above:
    // this is everything outstanding, not just what's due today.
    prisma.learningActivity.findMany({
      where: {
        studentId: studentProfile.id,
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { supervisor: { select: { user: { select: { name: true } } } } },
    }),
    prisma.shadowingAssignment.findMany({
      where: {
        studentId: studentProfile.id,
        appointment: {
          scheduledAt: { gte: new Date() },
          // A future scheduledAt alone isn't enough -- status matters
          // too, since nothing stops an appointment's status from
          // reaching a terminal state out of step with its original
          // timestamp (e.g. cancelled ahead of time).
          status: { notIn: ["CANCELLED", "COMPLETED", "NO_SHOW"] },
        },
      },
      orderBy: { appointment: { scheduledAt: "asc" } },
      take: 5,
      include: {
        appointment: {
          select: {
            scheduledAt: true,
            doctor: { select: { user: { select: { name: true } } } },
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.studentPlacement.findFirst({
      where: { studentId: studentProfile.id, status: "ACTIVE" },
      include: {
        supervisor: { select: { user: { select: { name: true } } } },
        department: { select: { name: true } },
      },
    }),
    // Real aggregate over actual logbook rows -- never a fabricated
    // "hours logged" number, matching the Stage 5 logbook's own rule.
    prisma.clinicalLogbookEntry.aggregate({
      where: { studentId: studentProfile.id },
      _sum: { hours: true },
    }),
    getStudentCompetencyProgressForUser(user, studentProfile.id),
  ]);

  return {
    todaysActivities,
    pendingReflectionActivities,
    upcomingShadowing,
    currentPlacement,
    totalHoursLogged: Number(hoursLogged._sum.hours ?? 0),
    competencyProgress: competencyProgress.progress,
  };
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

export async function getStudentDashboard() {
  const user = await requireUser();
  return getStudentDashboardForUser(user);
}
