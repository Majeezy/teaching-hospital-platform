import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requestAppointmentForUser } from "@/actions/appointments";
import {
  getUnreadMessageCountForUser,
  listEligibleRecipientsForUser,
  listInboxForUser,
  listSentForUser,
  markMessageReadForUser,
  sendMessageForUser,
} from "@/actions/messages";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("messaging: relationship-scoped recipients and delivery (real database)", () => {
  let patientAUserId: string;
  let patientBUserId: string;
  let doctorAUserId: string;
  let doctorAProfileId: string;
  let doctorBUserId: string;
  let nurseUserId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let supervisorUserId: string;
  let supervisorProfileId: string;
  let adminUserId: string;
  let appointmentId: string;
  const createdPlacementIds: string[] = [];
  const createdMessageIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, studentRole, patientRole, doctorRole, nurseRole] =
      await Promise.all([
        hashPassword("test-password-123"),
        prisma.department.findFirstOrThrow(),
        prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } }),
        prisma.role.findUniqueOrThrow({ where: { name: "PATIENT" } }),
        prisma.role.findUniqueOrThrow({ where: { name: "DOCTOR" } }),
        prisma.role.findUniqueOrThrow({ where: { name: "NURSE" } }),
      ]);
    const stamp = Date.now();
    const departmentId = department.id;

    const [patientA, patientB, doctorA, doctorB, nurse, student, supervisor, admin] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Message Patient A",
            email: `test-msg-patient-a-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: { create: { dateOfBirth: new Date("1990-01-01") } },
          },
        }),
        prisma.user.create({
          data: {
            name: "Message Patient B",
            email: `test-msg-patient-b-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: { create: { dateOfBirth: new Date("1991-01-01") } },
          },
        }),
        prisma.user.create({
          data: {
            name: "Message Doctor A",
            email: `test-msg-doctor-a-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: doctorRole.id } },
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-MSG-A-${stamp}`,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Message Doctor B",
            email: `test-msg-doctor-b-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: doctorRole.id } },
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-MSG-B-${stamp}`,
              },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: "Message Nurse",
            email: `test-msg-nurse-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: nurseRole.id } },
            nurseProfile: { create: { departmentId } },
          },
        }),
        prisma.user.create({
          data: {
            name: "Message Student",
            email: `test-msg-student-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-MSG-${stamp}`,
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
            name: "Message Supervisor",
            email: `test-msg-supervisor-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: doctorRole.id } },
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-MSG-SUP-${stamp}`,
                canSupervise: true,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Message Admin",
            email: `test-msg-admin-${stamp}@example.com`,
            passwordHash,
          },
        }),
      ]);

    patientAUserId = patientA.id;
    patientBUserId = patientB.id;
    doctorAUserId = doctorA.id;
    doctorAProfileId = doctorA.doctorProfile!.id;
    doctorBUserId = doctorB.id;
    nurseUserId = nurse.id;
    studentUserId = student.id;
    studentProfileId = student.studentProfile!.id;
    supervisorUserId = supervisor.id;
    supervisorProfileId = supervisor.doctorProfile!.id;
    adminUserId = admin.id;

    allUserIds.push(
      patientAUserId,
      patientBUserId,
      doctorAUserId,
      doctorBUserId,
      nurseUserId,
      studentUserId,
      supervisorUserId,
      adminUserId,
    );

    const appointment = await requestAppointmentForUser(asPatientA(), {
      doctorId: doctorAProfileId,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      reason: "Messaging relationship fixture",
    });
    appointmentId = appointment.id;

    const placement = await prisma.studentPlacement.create({
      data: {
        studentId: studentProfileId,
        departmentId,
        supervisorId: supervisorProfileId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: "ACTIVE",
      },
    });
    createdPlacementIds.push(placement.id);
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { id: { in: createdMessageIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: allUserIds } } });
    await prisma.studentPlacement.deleteMany({
      where: { id: { in: createdPlacementIds } },
    });
    await prisma.appointment.deleteMany({ where: { id: appointmentId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: allUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  });

  function asPatientA(): SessionUser {
    return {
      id: patientAUserId,
      name: "Message Patient A",
      email: "patient-a@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asPatientB(): SessionUser {
    return {
      id: patientBUserId,
      name: "Message Patient B",
      email: "patient-b@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asDoctorA(): SessionUser {
    return {
      id: doctorAUserId,
      name: "Message Doctor A",
      email: "doctor-a@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asNurse(): SessionUser {
    return {
      id: nurseUserId,
      name: "Message Nurse",
      email: "nurse@test",
      roles: ["NURSE"],
      isActive: true,
    };
  }

  function asStudent(): SessionUser {
    return {
      id: studentUserId,
      name: "Message Student",
      email: "student@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  function asSupervisor(): SessionUser {
    return {
      id: supervisorUserId,
      name: "Message Supervisor",
      email: "supervisor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asAdmin(): SessionUser {
    return {
      id: adminUserId,
      name: "Message Admin",
      email: "admin@test",
      roles: ["HOSPITAL_ADMIN"],
      isActive: true,
    };
  }

  it("a patient's eligible recipients are only doctors they've had an appointment with", async () => {
    const [recipientsA, recipientsB] = await Promise.all([
      listEligibleRecipientsForUser(asPatientA()),
      listEligibleRecipientsForUser(asPatientB()),
    ]);
    expect(recipientsA.some((r) => r.userId === doctorAUserId)).toBe(true);
    expect(recipientsA.some((r) => r.userId === doctorBUserId)).toBe(false);
    expect(recipientsB).toHaveLength(0);
  });

  it("a student's eligible recipients are only their own supervisor(s)", async () => {
    const recipients = await listEligibleRecipientsForUser(asStudent());
    expect(recipients).toEqual([
      { userId: supervisorUserId, name: "Message Supervisor", roles: ["DOCTOR"] },
    ]);
  });

  it("a doctor's eligible recipients include other staff, plus their own patients and students", async () => {
    const [doctorARecipients, supervisorRecipients] = await Promise.all([
      listEligibleRecipientsForUser(asDoctorA()),
      listEligibleRecipientsForUser(asSupervisor()),
    ]);

    expect(doctorARecipients.some((r) => r.userId === doctorBUserId)).toBe(true);
    expect(doctorARecipients.some((r) => r.userId === nurseUserId)).toBe(true);
    expect(doctorARecipients.some((r) => r.userId === patientAUserId)).toBe(true);
    expect(doctorARecipients.some((r) => r.userId === patientBUserId)).toBe(false);

    expect(supervisorRecipients.some((r) => r.userId === studentUserId)).toBe(true);
  });

  it("nurses can message staff but have no patient/student relationship to surface", async () => {
    const recipients = await listEligibleRecipientsForUser(asNurse());
    expect(recipients.some((r) => r.userId === doctorAUserId)).toBe(true);
    // Checked against this fixture's own patient/student, not "no
    // recipient anywhere has a PATIENT/STUDENT role" -- the shared dev
    // database can legitimately contain a dual-role staff member from a
    // concurrently-running test file (e.g. a doctor who is also a
    // patient), and that's correct behavior to surface, not a leak.
    expect(recipients.some((r) => r.userId === patientAUserId)).toBe(false);
    expect(recipients.some((r) => r.userId === patientBUserId)).toBe(false);
    expect(recipients.some((r) => r.userId === studentUserId)).toBe(false);
  });

  it("admin can message anyone", async () => {
    const recipients = await listEligibleRecipientsForUser(asAdmin());
    expect(recipients.some((r) => r.userId === patientBUserId)).toBe(true);
    expect(recipients.some((r) => r.userId === studentUserId)).toBe(true);
  });

  it("rejects sending to someone outside the relationship, even if the id is real", async () => {
    await expect(
      sendMessageForUser(asPatientB(), {
        recipientId: doctorAUserId,
        body: "I have no relationship with this doctor.",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("lets a patient message their own doctor, and it shows up in both inboxes correctly", async () => {
    const message = await sendMessageForUser(asPatientA(), {
      recipientId: doctorAUserId,
      subject: "Question",
      body: "When should I come in for a follow-up?",
    });
    createdMessageIds.push(message.id);

    const [doctorInbox, patientSent] = await Promise.all([
      listInboxForUser(asDoctorA()),
      listSentForUser(asPatientA()),
    ]);
    expect(doctorInbox.some((m) => m.id === message.id)).toBe(true);
    expect(patientSent.some((m) => m.id === message.id)).toBe(true);

    const patientBInbox = await listInboxForUser(asPatientB());
    expect(patientBInbox.some((m) => m.id === message.id)).toBe(false);
  });

  it("tracks unread count and marks a message read, scoped to the recipient only", async () => {
    const before = await getUnreadMessageCountForUser(asDoctorA());
    expect(before).toBeGreaterThan(0);

    const inbox = await listInboxForUser(asDoctorA());
    const targetId = inbox[0].id;

    // Someone else marking it read is a silent no-op.
    await markMessageReadForUser(asPatientB(), targetId);
    const stillUnread = await prisma.message.findUniqueOrThrow({
      where: { id: targetId },
    });
    expect(stillUnread.readAt).toBeNull();

    await markMessageReadForUser(asDoctorA(), targetId);
    const after = await getUnreadMessageCountForUser(asDoctorA());
    expect(after).toBe(before - 1);
  });
});
