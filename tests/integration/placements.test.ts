import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  createPlacementForUser,
  listPlacementsForUser,
} from "@/actions/placements";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("clinical placements authorization (real database)", () => {
  let adminUserId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let studentBUserId: string;
  let supervisorUserId: string;
  let supervisorProfileId: string;
  let nonSupervisorDoctorProfileId: string;
  let departmentId: string;
  const createdPlacementIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department] = await Promise.all([
      hashPassword("test-password-123"),
      prisma.department.findFirstOrThrow(),
    ]);
    const stamp = Date.now();
    departmentId = department.id;
    const studentRole = await prisma.role.findUniqueOrThrow({
      where: { name: "STUDENT" },
    });

    const [admin, student, studentB, supervisor, nonSupervisorDoctor] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Test Admin",
            email: `test-placement-admin-${stamp}@example.com`,
            passwordHash,
          },
        }),
        prisma.user.create({
          data: {
            name: "Test Student",
            email: `test-placement-student-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-PL-${stamp}`,
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
            name: "Student B",
            email: `test-placement-student-b-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-PL-B-${stamp}`,
                university: "University of Testing",
                yearOfStudy: 2,
                program: "MBChB",
              },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: "Supervisor Doctor",
            email: `test-placement-supervisor-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-PL-SUP-${stamp}`,
                canSupervise: true,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Non-Supervisor Doctor",
            email: `test-placement-nonsup-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-PL-NOSUP-${stamp}`,
                canSupervise: false,
              },
            },
          },
          include: { doctorProfile: true },
        }),
      ]);

    adminUserId = admin.id;
    studentUserId = student.id;
    studentProfileId = student.studentProfile!.id;
    studentBUserId = studentB.id;
    supervisorUserId = supervisor.id;
    supervisorProfileId = supervisor.doctorProfile!.id;
    nonSupervisorDoctorProfileId = nonSupervisorDoctor.doctorProfile!.id;

    allUserIds.push(
      adminUserId,
      studentUserId,
      studentBUserId,
      supervisorUserId,
      nonSupervisorDoctor.id,
    );
  });

  afterAll(async () => {
    if (createdPlacementIds.length > 0) {
      await prisma.studentPlacement.deleteMany({
        where: { id: { in: createdPlacementIds } },
      });
    }
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: allUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  });

  function asAdmin(): SessionUser {
    return {
      id: adminUserId,
      name: "Test Admin",
      email: "admin@test",
      roles: ["HOSPITAL_ADMIN"],
      isActive: true,
    };
  }

  function asStudent(): SessionUser {
    return {
      id: studentUserId,
      name: "Test Student",
      email: "student@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  function asStudentB(): SessionUser {
    return {
      id: studentBUserId,
      name: "Student B",
      email: "student-b@test",
      roles: ["STUDENT"],
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

  function dateRange() {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  it("rejects an end date before the start date", async () => {
    await expect(
      createPlacementForUser(asAdmin(), {
        studentId: studentProfileId,
        departmentId,
        supervisorId: supervisorProfileId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() - 86400000).toISOString(),
      }),
    ).rejects.toThrow("End date must be after the start date.");
  });

  it("rejects a doctor who isn't marked as able to supervise", async () => {
    await expect(
      createPlacementForUser(asAdmin(), {
        studentId: studentProfileId,
        departmentId,
        supervisorId: nonSupervisorDoctorProfileId,
        ...dateRange(),
      }),
    ).rejects.toThrow("not marked as able to supervise");
  });

  it("rejects a non-admin creating a placement", async () => {
    await expect(
      createPlacementForUser(asSupervisor(), {
        studentId: studentProfileId,
        departmentId,
        supervisorId: supervisorProfileId,
        ...dateRange(),
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("creates a placement and scopes visibility correctly per role", async () => {
    const placement = await createPlacementForUser(asAdmin(), {
      studentId: studentProfileId,
      departmentId,
      supervisorId: supervisorProfileId,
      ...dateRange(),
    });
    createdPlacementIds.push(placement.id);
    expect(placement.status).toBe("ACTIVE");

    const [adminView, supervisorView, studentView, studentBView] =
      await Promise.all([
        listPlacementsForUser(asAdmin()),
        listPlacementsForUser(asSupervisor()),
        listPlacementsForUser(asStudent()),
        listPlacementsForUser(asStudentB()),
      ]);

    expect(adminView.some((p) => p.id === placement.id)).toBe(true);
    expect(supervisorView.some((p) => p.id === placement.id)).toBe(true);
    expect(studentView.some((p) => p.id === placement.id)).toBe(true);
    expect(studentBView.some((p) => p.id === placement.id)).toBe(false);
  });
});
