import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  requestAppointmentForUser,
  updateAppointmentStatusForUser,
} from "@/actions/appointments";
import { assignShadowingForUser } from "@/actions/shadowing";
import {
  assignActivityForUser,
  giveFeedbackForUser,
  submitReflectionForUser,
} from "@/actions/learning-activities";
import { recordAssessmentForUser } from "@/actions/competencies";
import { createPlacementForUser } from "@/actions/placements";
import {
  getUnreadNotificationCountForUser,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "@/actions/notifications";
import { type SessionUser } from "@/lib/permissions";

describe("notifications: real triggers across every module (real database)", () => {
  let adminUserId: string;
  let patientUserId: string;
  let supervisorUserId: string;
  let supervisorProfileId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let otherStudentUserId: string;
  let competencyId: string;
  let appointmentId: string;
  let secondAppointmentId: string;
  let learningActivityId: string;
  const createdPlacementIds: string[] = [];
  const createdAppointmentIds: string[] = [];
  const createdActivityIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, studentRole, patientRole, competency] =
      await Promise.all([
        hashPassword("test-password-123"),
        prisma.department.findFirstOrThrow(),
        prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } }),
        prisma.role.findUniqueOrThrow({ where: { name: "PATIENT" } }),
        prisma.competency.findFirstOrThrow(),
      ]);
    const stamp = Date.now();
    const departmentId = department.id;
    competencyId = competency.id;

    const [admin, patient, supervisor, student, otherStudent] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Notif Admin",
            email: `test-notif-admin-${stamp}@example.com`,
            passwordHash,
          },
        }),
        prisma.user.create({
          data: {
            name: "Notif Patient",
            email: `test-notif-patient-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: { create: { dateOfBirth: new Date("1990-01-01") } },
          },
        }),
        prisma.user.create({
          data: {
            name: "Notif Supervisor",
            email: `test-notif-supervisor-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-NOTIF-${stamp}`,
                canSupervise: true,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Notif Student",
            email: `test-notif-student-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-NOTIF-${stamp}`,
                university: "University of Testing",
                yearOfStudy: 3,
                program: "MBChB",
              },
            },
          },
          include: { studentProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Other Student",
            email: `test-notif-other-student-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
          },
        }),
      ]);

    adminUserId = admin.id;
    patientUserId = patient.id;
    supervisorUserId = supervisor.id;
    supervisorProfileId = supervisor.doctorProfile!.id;
    studentUserId = student.id;
    studentProfileId = student.studentProfile!.id;
    otherStudentUserId = otherStudent.id;

    allUserIds.push(
      adminUserId,
      patientUserId,
      supervisorUserId,
      studentUserId,
      otherStudentUserId,
    );
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: allUserIds } } });
    await prisma.feedback.deleteMany({
      where: { relatedActivityId: { in: createdActivityIds } },
    });
    await prisma.studentReflection.deleteMany({
      where: { learningActivityId: { in: createdActivityIds } },
    });
    await prisma.learningActivity.deleteMany({
      where: { id: { in: createdActivityIds } },
    });
    await prisma.competencyAssessment.deleteMany({
      where: { studentCompetency: { studentId: studentProfileId } },
    });
    await prisma.studentCompetency.deleteMany({
      where: { studentId: studentProfileId },
    });
    await prisma.shadowingAssignment.deleteMany({
      where: { appointmentId: { in: createdAppointmentIds } },
    });
    await prisma.clinicalLogbookEntry.deleteMany({
      where: { relatedAppointmentId: { in: createdAppointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: createdAppointmentIds } },
    });
    await prisma.studentPlacement.deleteMany({
      where: { id: { in: createdPlacementIds } },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: allUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  });

  function asAdmin(): SessionUser {
    return {
      id: adminUserId,
      name: "Notif Admin",
      email: "admin@test",
      roles: ["HOSPITAL_ADMIN"],
      isActive: true,
    };
  }

  function asPatient(): SessionUser {
    return {
      id: patientUserId,
      name: "Notif Patient",
      email: "patient@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asSupervisor(): SessionUser {
    return {
      id: supervisorUserId,
      name: "Notif Supervisor",
      email: "supervisor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asStudent(): SessionUser {
    return {
      id: studentUserId,
      name: "Notif Student",
      email: "student@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  function asOtherStudent(): SessionUser {
    return {
      id: otherStudentUserId,
      name: "Other Student",
      email: "other-student@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  async function latestNotificationFor(userId: string) {
    return prisma.notification.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  it("notifies both the student and the supervisor when a placement is created", async () => {
    const department = await prisma.department.findFirstOrThrow();
    const placement = await createPlacementForUser(asAdmin(), {
      studentId: studentProfileId,
      departmentId: department.id,
      supervisorId: supervisorProfileId,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    createdPlacementIds.push(placement.id);

    const [studentNotif, supervisorNotif] = await Promise.all([
      latestNotificationFor(studentUserId),
      latestNotificationFor(supervisorUserId),
    ]);
    expect(studentNotif?.type).toBe("PLACEMENT_CREATED");
    expect(supervisorNotif?.type).toBe("PLACEMENT_CREATED");
  });

  it("notifies the doctor when a patient requests an appointment", async () => {
    const appointment = await requestAppointmentForUser(asPatient(), {
      doctorId: supervisorProfileId,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      reason: "Notification trigger test",
    });
    appointmentId = appointment.id;
    createdAppointmentIds.push(appointmentId);

    const notif = await latestNotificationFor(supervisorUserId);
    expect(notif?.type).toBe("APPOINTMENT_REQUESTED");
    expect(notif?.body).toContain("Notif Patient");
  });

  it("notifies the patient when the doctor confirms the appointment", async () => {
    await updateAppointmentStatusForUser(asSupervisor(), appointmentId, "CONFIRMED");

    const notif = await latestNotificationFor(patientUserId);
    expect(notif?.type).toBe("APPOINTMENT_CONFIRMED");
  });

  it("notifies the student when assigned to shadow the appointment", async () => {
    await assignShadowingForUser(asSupervisor(), {
      appointmentId,
      studentId: studentProfileId,
    });

    const notif = await latestNotificationFor(studentUserId);
    expect(notif?.type).toBe("SHADOWING_ASSIGNED");
  });

  it("notifies the student when a learning activity is assigned", async () => {
    const activity = await assignActivityForUser(asSupervisor(), {
      studentId: studentProfileId,
      title: "Notification trigger activity",
      description: "Testing the ACTIVITY_ASSIGNED notification.",
    });
    learningActivityId = activity.id;
    createdActivityIds.push(learningActivityId);

    const notif = await latestNotificationFor(studentUserId);
    expect(notif?.type).toBe("ACTIVITY_ASSIGNED");
  });

  it("notifies the supervisor when the student submits a reflection", async () => {
    await submitReflectionForUser(asStudent(), {
      learningActivityId,
      content: "Testing the REFLECTION_SUBMITTED notification.",
    });

    const notif = await latestNotificationFor(supervisorUserId);
    expect(notif?.type).toBe("REFLECTION_SUBMITTED");
  });

  it("notifies the student when the supervisor gives feedback", async () => {
    await giveFeedbackForUser(asSupervisor(), {
      learningActivityId,
      rating: 5,
      strengths: "Good observation.",
    });

    const notif = await latestNotificationFor(studentUserId);
    expect(notif?.type).toBe("FEEDBACK_GIVEN");
  });

  it("notifies the student when a competency is assessed", async () => {
    await recordAssessmentForUser(asSupervisor(), {
      studentId: studentProfileId,
      competencyId,
      score: 4,
    });

    const notif = await latestNotificationFor(studentUserId);
    expect(notif?.type).toBe("COMPETENCY_ASSESSED");
  });

  it("notifies the patient when the appointment completes", async () => {
    await updateAppointmentStatusForUser(asSupervisor(), appointmentId, "IN_PROGRESS");
    await updateAppointmentStatusForUser(asSupervisor(), appointmentId, "COMPLETED");

    const notif = await latestNotificationFor(patientUserId);
    expect(notif?.type).toBe("APPOINTMENT_COMPLETED");
  });

  it("notifies the doctor when the patient (not the doctor) cancels an appointment", async () => {
    const second = await requestAppointmentForUser(asPatient(), {
      doctorId: supervisorProfileId,
      scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      reason: "Will be cancelled by the patient",
    });
    secondAppointmentId = second.id;
    createdAppointmentIds.push(secondAppointmentId);

    await updateAppointmentStatusForUser(asSupervisor(), secondAppointmentId, "CONFIRMED");
    await updateAppointmentStatusForUser(asPatient(), secondAppointmentId, "CANCELLED");

    const notif = await latestNotificationFor(supervisorUserId);
    expect(notif?.type).toBe("APPOINTMENT_CANCELLED");
    expect(notif?.title).toContain("cancelled by patient");
  });

  it("lists notifications scoped to the requesting user only", async () => {
    const [studentNotifications, otherStudentNotifications] = await Promise.all([
      listNotificationsForUser(asStudent()),
      listNotificationsForUser(asOtherStudent()),
    ]);
    expect(studentNotifications.length).toBeGreaterThan(0);
    expect(studentNotifications.every((n) => n.userId === studentUserId)).toBe(true);
    expect(otherStudentNotifications).toHaveLength(0);
  });

  it("reports an accurate unread count", async () => {
    const [notifications, unreadCount] = await Promise.all([
      listNotificationsForUser(asStudent()),
      getUnreadNotificationCountForUser(asStudent()),
    ]);
    expect(unreadCount).toBe(notifications.filter((n) => !n.isRead).length);
    expect(unreadCount).toBeGreaterThan(0);
  });

  it("marking another user's notification read is a silent no-op", async () => {
    const studentNotifications = await listNotificationsForUser(asStudent());
    const targetId = studentNotifications[0].id;

    await markNotificationReadForUser(asOtherStudent(), targetId);

    const unchanged = await prisma.notification.findUniqueOrThrow({
      where: { id: targetId },
    });
    expect(unchanged.isRead).toBe(false);
  });

  it("marks a single owned notification as read", async () => {
    const studentNotifications = await listNotificationsForUser(asStudent());
    const targetId = studentNotifications[0].id;

    await markNotificationReadForUser(asStudent(), targetId);

    const updated = await prisma.notification.findUniqueOrThrow({
      where: { id: targetId },
    });
    expect(updated.isRead).toBe(true);
  });

  it("marks every remaining notification as read for that user only", async () => {
    await markAllNotificationsReadForUser(asStudent());

    const [studentUnread, supervisorUnread] = await Promise.all([
      getUnreadNotificationCountForUser(asStudent()),
      getUnreadNotificationCountForUser(asSupervisor()),
    ]);
    expect(studentUnread).toBe(0);
    expect(supervisorUnread).toBeGreaterThan(0);
  });
});
