import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  createStudentForUser,
  listStudentsForUser,
} from "@/actions/students";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("student management authorization (real database)", () => {
  let adminUserId: string;
  let patientUserId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword("test-password-123");
    const stamp = Date.now();

    const [admin, patient] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Test Admin",
          email: `test-student-admin-${stamp}@example.com`,
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          name: "Test Patient",
          email: `test-student-patient-${stamp}@example.com`,
          passwordHash,
        },
      }),
    ]);
    adminUserId = admin.id;
    patientUserId = patient.id;
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [adminUserId, patientUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, patientUserId] } },
    });
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

  function asPatient(): SessionUser {
    return {
      id: patientUserId,
      name: "Test Patient",
      email: "patient@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  it("allows a hospital admin to create a student account with a profile", async () => {
    const stamp = Date.now();
    const student = await createStudentForUser(asAdmin(), {
      name: "Student Test",
      email: `test-new-student-${stamp}@example.com`,
      password: "test-password-123",
      studentNumber: `STU-${stamp}`,
      university: "University of Testing",
      yearOfStudy: 3,
      program: "MBChB",
    });
    createdUserIds.push(student.id);

    const created = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
      include: { roles: { include: { role: true } }, studentProfile: true },
    });

    expect(created.roles.map((r) => r.role.name)).toContain("STUDENT");
    expect(created.studentProfile?.yearOfStudy).toBe(3);
    expect(created.studentProfile?.program).toBe("MBChB");
  });

  it("rejects a duplicate student number", async () => {
    const stamp = Date.now();
    const studentNumber = `STU-DUP-${stamp}`;

    const first = await createStudentForUser(asAdmin(), {
      name: "First Student",
      email: `test-first-student-${stamp}@example.com`,
      password: "test-password-123",
      studentNumber,
      university: "University of Testing",
      yearOfStudy: 1,
      program: "MBChB",
    });
    createdUserIds.push(first.id);

    await expect(
      createStudentForUser(asAdmin(), {
        name: "Second Student",
        email: `test-second-student-${stamp}@example.com`,
        password: "test-password-123",
        studentNumber,
        university: "University of Testing",
        yearOfStudy: 1,
        program: "MBChB",
      }),
    ).rejects.toThrow("student number already exists");
  });

  it("rejects a patient creating a student account", async () => {
    await expect(
      createStudentForUser(asPatient(), {
        name: "Should not be created",
        email: `should-not-exist-${Date.now()}@example.com`,
        password: "test-password-123",
        studentNumber: `STU-REJECT-${Date.now()}`,
        university: "University of Testing",
        yearOfStudy: 1,
        program: "MBChB",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects a patient listing students", async () => {
    await expect(listStudentsForUser(asPatient())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("lists created students for a hospital admin", async () => {
    const stamp = Date.now();
    const student = await createStudentForUser(asAdmin(), {
      name: "Listed Student",
      email: `test-listed-student-${stamp}@example.com`,
      password: "test-password-123",
      studentNumber: `STU-LIST-${stamp}`,
      university: "University of Testing",
      yearOfStudy: 2,
      program: "MBChB",
    });
    createdUserIds.push(student.id);

    const students = await listStudentsForUser(asAdmin());
    expect(students.some((s) => s.id === student.id)).toBe(true);
  });
});
