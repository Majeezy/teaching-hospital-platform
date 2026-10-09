import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  assignShadowingForUser,
  listShadowableStudentsForUser,
  listShadowingForAppointmentForUser,
} from "@/actions/shadowing";
import {
  getAppointmentForUser,
  listAppointmentsForUser,
  requestAppointmentForUser,
} from "@/actions/appointments";
import { getAppointmentRecordsForUser } from "@/actions/clinical-records";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("shadowing authorization and data scoping (real database)", () => {
  let patientUserId: string;
  let supervisorUserId: string;
  let supervisorProfileId: string;
  let noSuperviseUserId: string;
  let noSuperviseProfileId: string;
  let studentPlacedUserId: string;
  let studentPlacedProfileId: string;
  let studentOtherUserId: string;
  let studentOtherProfileId: string;
  let studentUnplacedUserId: string;
  let appointmentMainId: string;
  let appointmentNoSuperviseId: string;
  let appointmentCancelledId: string;
  const createdPlacementIds: string[] = [];
  const createdAppointmentIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, studentRole] = await Promise.all([
      hashPassword("test-password-123"),
      prisma.department.findFirstOrThrow(),
      prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } }),
    ]);
    const stamp = Date.now();
    const departmentId = department.id;

    const [patient, supervisor, noSupervise, studentPlaced, studentOther, studentUnplaced] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Shadow Patient",
            email: `test-shadow-patient-${stamp}@example.com`,
            passwordHash,
            roles: {
              create: {
                roleId: (await prisma.role.findUniqueOrThrow({
                  where: { name: "PATIENT" },
                })).id,
              },
            },
            patientProfile: { create: { dateOfBirth: new Date("1995-01-01") } },
          },
        }),
        prisma.user.create({
          data: {
            name: "Supervisor Doctor",
            email: `test-shadow-supervisor-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-SH-SUP-${stamp}`,
                canSupervise: true,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Non-Supervising Doctor",
            email: `test-shadow-nosup-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-SH-NOSUP-${stamp}`,
                canSupervise: false,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Student Placed",
            email: `test-shadow-student-placed-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-SH-P-${stamp}`,
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
            name: "Student Other Supervisor",
            email: `test-shadow-student-other-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-SH-O-${stamp}`,
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
            name: "Student Unplaced",
            email: `test-shadow-student-unplaced-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-SH-U-${stamp}`,
                university: "University of Testing",
                yearOfStudy: 1,
                program: "MBChB",
              },
            },
          },
        }),
      ]);

    patientUserId = patient.id;
    supervisorUserId = supervisor.id;
    supervisorProfileId = supervisor.doctorProfile!.id;
    noSuperviseUserId = noSupervise.id;
    noSuperviseProfileId = noSupervise.doctorProfile!.id;
    studentPlacedUserId = studentPlaced.id;
    studentPlacedProfileId = studentPlaced.studentProfile!.id;
    studentOtherUserId = studentOther.id;
    studentOtherProfileId = studentOther.studentProfile!.id;
    studentUnplacedUserId = studentUnplaced.id;

    allUserIds.push(
      patientUserId,
      supervisorUserId,
      noSuperviseUserId,
      studentPlacedUserId,
      studentOtherUserId,
      studentUnplacedUserId,
    );

    // studentPlaced has an active placement under the supervisor;
    // studentOther has one under a *different* supervisor (noSupervise,
    // used here purely as "some other doctor") so we can prove shadowing
    // eligibility is scoped per-supervisor, not "any active placement".
    const [placementPlaced, placementOther] = await Promise.all([
      prisma.studentPlacement.create({
        data: {
          studentId: studentPlacedProfileId,
          departmentId,
          supervisorId: supervisorProfileId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          status: "ACTIVE",
        },
      }),
      prisma.studentPlacement.create({
        data: {
          studentId: studentOtherProfileId,
          departmentId,
          supervisorId: noSuperviseProfileId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          status: "ACTIVE",
        },
      }),
    ]);
    createdPlacementIds.push(placementPlaced.id, placementOther.id);

    const [appointmentMain, appointmentNoSupervise, appointmentCancelled] =
      await Promise.all([
        requestAppointmentForUser(asPatient(), {
          doctorId: supervisorProfileId,
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          reason: "Shadowing test appointment",
        }),
        requestAppointmentForUser(asPatient(), {
          doctorId: noSuperviseProfileId,
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          reason: "Non-supervising doctor's appointment",
        }),
        requestAppointmentForUser(asPatient(), {
          doctorId: supervisorProfileId,
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          reason: "Will be cancelled",
        }),
      ]);
    appointmentMainId = appointmentMain.id;
    appointmentNoSuperviseId = appointmentNoSupervise.id;
    appointmentCancelledId = appointmentCancelled.id;
    createdAppointmentIds.push(
      appointmentMainId,
      appointmentNoSuperviseId,
      appointmentCancelledId,
    );

    await prisma.appointment.update({
      where: { id: appointmentCancelledId },
      data: { status: "CANCELLED" },
    });
  });

  afterAll(async () => {
    await prisma.shadowingAssignment.deleteMany({
      where: { appointmentId: { in: createdAppointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: createdAppointmentIds } },
    });
    await prisma.studentPlacement.deleteMany({
      where: { id: { in: createdPlacementIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: allUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  });

  function asPatient(): SessionUser {
    return {
      id: patientUserId,
      name: "Shadow Patient",
      email: "shadow-patient@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asSupervisor(): SessionUser {
    return {
      id: supervisorUserId,
      name: "Supervisor Doctor",
      email: "supervisor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asNoSupervise(): SessionUser {
    return {
      id: noSuperviseUserId,
      name: "Non-Supervising Doctor",
      email: "nosup@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asStudentPlaced(): SessionUser {
    return {
      id: studentPlacedUserId,
      name: "Student Placed",
      email: "student-placed@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  function asStudentOther(): SessionUser {
    return {
      id: studentOtherUserId,
      name: "Student Other Supervisor",
      email: "student-other@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  function asStudentUnplaced(): SessionUser {
    return {
      id: studentUnplacedUserId,
      name: "Student Unplaced",
      email: "student-unplaced@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  it("rejects a non-doctor managing shadowing", async () => {
    await expect(
      listShadowableStudentsForUser(asPatient(), appointmentMainId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects a doctor who isn't marked as able to supervise", async () => {
    await expect(
      listShadowableStudentsForUser(asNoSupervise(), appointmentNoSuperviseId),
    ).rejects.toThrow("not marked as able to supervise");
  });

  it("rejects a doctor managing shadowing for someone else's appointment", async () => {
    await expect(
      listShadowableStudentsForUser(asSupervisor(), appointmentNoSuperviseId),
    ).rejects.toThrow("your own appointments");
  });

  it("only lists students with an active placement under this specific supervisor", async () => {
    const shadowable = await listShadowableStudentsForUser(
      asSupervisor(),
      appointmentMainId,
    );
    expect(shadowable.some((s) => s.id === studentPlacedProfileId)).toBe(true);
    expect(shadowable.some((s) => s.id === studentOtherProfileId)).toBe(false);
  });

  it("rejects assigning a student with no active placement under this supervisor", async () => {
    await expect(
      assignShadowingForUser(asSupervisor(), {
        appointmentId: appointmentMainId,
        studentId: studentOtherProfileId,
      }),
    ).rejects.toThrow("does not have an active placement");
  });

  it("rejects assigning shadowing to a cancelled appointment", async () => {
    await expect(
      assignShadowingForUser(asSupervisor(), {
        appointmentId: appointmentCancelledId,
        studentId: studentPlacedProfileId,
      }),
    ).rejects.toThrow("cancelled or no-show");
  });

  it("rejects a shadowing-less student from accessing the appointment at all", async () => {
    await expect(
      getAppointmentForUser(asStudentPlaced(), appointmentMainId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("assigns a placed student to shadow the appointment", async () => {
    const assignment = await assignShadowingForUser(asSupervisor(), {
      appointmentId: appointmentMainId,
      studentId: studentPlacedProfileId,
    });
    expect(assignment.studentId).toBe(studentPlacedProfileId);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { actorId: supervisorUserId, action: "ASSIGNED_SHADOWING" },
    });
    expect(auditEntry).not.toBeNull();
  });

  it("rejects a duplicate shadowing assignment", async () => {
    await expect(
      assignShadowingForUser(asSupervisor(), {
        appointmentId: appointmentMainId,
        studentId: studentPlacedProfileId,
      }),
    ).rejects.toThrow("already assigned");
  });

  it("lets the now-assigned student access the appointment, scoped to notes + diagnosis only", async () => {
    const { isShadowingStudent, canEdit } = await getAppointmentForUser(
      asStudentPlaced(),
      appointmentMainId,
    );
    expect(isShadowingStudent).toBe(true);
    expect(canEdit).toBe(false);

    const records = await getAppointmentRecordsForUser(
      asStudentPlaced(),
      appointmentMainId,
    );
    expect(records.prescriptions).toEqual([]);
    expect(records.testOrders).toEqual([]);
  });

  it("still rejects a student with an active placement elsewhere but no shadowing assignment here", async () => {
    await expect(
      getAppointmentForUser(asStudentOther(), appointmentMainId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("includes the appointment in the shadowing student's appointment list, excludes everyone else", async () => {
    const [placedList, otherList, unplacedList] = await Promise.all([
      listAppointmentsForUser(asStudentPlaced()),
      listAppointmentsForUser(asStudentOther()),
      listAppointmentsForUser(asStudentUnplaced()),
    ]);
    expect(placedList.some((a) => a.id === appointmentMainId)).toBe(true);
    expect(otherList.some((a) => a.id === appointmentMainId)).toBe(false);
    expect(unplacedList.some((a) => a.id === appointmentMainId)).toBe(false);
  });

  it("surfaces the assignment to anyone who can already see the appointment", async () => {
    const [asSupervisorView, asPatientView] = await Promise.all([
      listShadowingForAppointmentForUser(asSupervisor(), appointmentMainId),
      listShadowingForAppointmentForUser(asPatient(), appointmentMainId),
    ]);
    expect(
      asSupervisorView.some((a) => a.student.id === studentPlacedProfileId),
    ).toBe(true);
    expect(
      asPatientView.some((a) => a.student.id === studentPlacedProfileId),
    ).toBe(true);
  });
});
