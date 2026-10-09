import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  requestAppointmentForUser,
  updateAppointmentStatusForUser,
} from "@/actions/appointments";
import { listLogbookEntriesForUser } from "@/actions/logbook";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("clinical logbook auto-generation and scoping (real database)", () => {
  let patientUserId: string;
  let doctorUserId: string;
  let doctorProfileId: string;
  let otherDoctorUserId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let otherStudentUserId: string;
  let shadowedAppointmentId: string;
  let unshadowedAppointmentId: string;
  const createdAppointmentIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, studentRole, patientRole] = await Promise.all([
      hashPassword("test-password-123"),
      prisma.department.findFirstOrThrow(),
      prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } }),
      prisma.role.findUniqueOrThrow({ where: { name: "PATIENT" } }),
    ]);
    const stamp = Date.now();
    const departmentId = department.id;

    const [patient, doctor, otherDoctor, student, otherStudent] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Logbook Patient",
            email: `test-logbook-patient-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: { create: { dateOfBirth: new Date("1990-01-01") } },
          },
        }),
        prisma.user.create({
          data: {
            name: "Logbook Doctor",
            email: `test-logbook-doctor-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-LOG-${stamp}`,
                canSupervise: true,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Other Doctor",
            email: `test-logbook-other-doctor-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-LOG-OTH-${stamp}`,
              },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: "Logbook Student",
            email: `test-logbook-student-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-LOG-${stamp}`,
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
            email: `test-logbook-other-student-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-LOG-OTH-${stamp}`,
                university: "University of Testing",
                yearOfStudy: 2,
                program: "MBChB",
              },
            },
          },
        }),
      ]);

    patientUserId = patient.id;
    doctorUserId = doctor.id;
    doctorProfileId = doctor.doctorProfile!.id;
    otherDoctorUserId = otherDoctor.id;
    studentUserId = student.id;
    studentProfileId = student.studentProfile!.id;
    otherStudentUserId = otherStudent.id;

    allUserIds.push(
      patientUserId,
      doctorUserId,
      otherDoctorUserId,
      studentUserId,
      otherStudentUserId,
    );

    const [shadowed, unshadowed] = await Promise.all([
      requestAppointmentForUser(asPatient(), {
        doctorId: doctorProfileId,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        reason: "Will be shadowed",
      }),
      requestAppointmentForUser(asPatient(), {
        doctorId: doctorProfileId,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        reason: "Will not be shadowed",
      }),
    ]);
    shadowedAppointmentId = shadowed.id;
    unshadowedAppointmentId = unshadowed.id;
    createdAppointmentIds.push(shadowedAppointmentId, unshadowedAppointmentId);

    await prisma.shadowingAssignment.create({
      data: { appointmentId: shadowedAppointmentId, studentId: studentProfileId },
    });
  });

  afterAll(async () => {
    await prisma.clinicalLogbookEntry.deleteMany({
      where: { relatedAppointmentId: { in: createdAppointmentIds } },
    });
    await prisma.shadowingAssignment.deleteMany({
      where: { appointmentId: { in: createdAppointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: createdAppointmentIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: allUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  });

  function asPatient(): SessionUser {
    return {
      id: patientUserId,
      name: "Logbook Patient",
      email: "logbook-patient@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asDoctor(): SessionUser {
    return {
      id: doctorUserId,
      name: "Logbook Doctor",
      email: "logbook-doctor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asOtherDoctor(): SessionUser {
    return {
      id: otherDoctorUserId,
      name: "Other Doctor",
      email: "other-doctor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asStudent(): SessionUser {
    return {
      id: studentUserId,
      name: "Logbook Student",
      email: "logbook-student@test",
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

  async function progressToCompleted(appointmentId: string) {
    await updateAppointmentStatusForUser(asDoctor(), appointmentId, "CONFIRMED");
    await updateAppointmentStatusForUser(asDoctor(), appointmentId, "IN_PROGRESS");
    return updateAppointmentStatusForUser(asDoctor(), appointmentId, "COMPLETED");
  }

  it("creates a logbook entry for the shadowing student when the appointment completes", async () => {
    await progressToCompleted(shadowedAppointmentId);

    const entries = await prisma.clinicalLogbookEntry.findMany({
      where: { relatedAppointmentId: shadowedAppointmentId },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].studentId).toBe(studentProfileId);
    expect(entries[0].type).toBe("OBSERVED_CONSULTATION");
    expect(Number(entries[0].hours)).toBeCloseTo(0.5, 5);
  });

  it("creates no logbook entry for an appointment nobody shadowed", async () => {
    await progressToCompleted(unshadowedAppointmentId);

    const entries = await prisma.clinicalLogbookEntry.findMany({
      where: { relatedAppointmentId: unshadowedAppointmentId },
    });
    expect(entries).toHaveLength(0);
  });

  it("scopes the logbook list correctly per role", async () => {
    const [studentView, doctorView, otherDoctorView, otherStudentView, adminView] =
      await Promise.all([
        listLogbookEntriesForUser(asStudent()),
        listLogbookEntriesForUser(asDoctor()),
        listLogbookEntriesForUser(asOtherDoctor()),
        listLogbookEntriesForUser(asOtherStudent()),
        listLogbookEntriesForUser({
          id: "admin-test",
          name: "Admin",
          email: "admin@test",
          roles: ["HOSPITAL_ADMIN"],
          isActive: true,
        }),
      ]);

    expect(
      studentView.some((e) => e.relatedAppointment?.scheduledAt),
    ).toBe(true);
    expect(studentView.every((e) => e.studentId === studentProfileId)).toBe(true);
    expect(doctorView.some((e) => e.studentId === studentProfileId)).toBe(true);
    expect(otherDoctorView.length).toBe(0);
    expect(otherStudentView.length).toBe(0);
    expect(adminView.some((e) => e.studentId === studentProfileId)).toBe(true);
  });

  it("rejects a role with no access to the logbook", async () => {
    await expect(
      listLogbookEntriesForUser(asPatient()),
    ).rejects.toThrow(AuthorizationError);
  });
});
