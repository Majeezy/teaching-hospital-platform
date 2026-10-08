import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  createDepartmentForUser,
  deleteDepartmentForUser,
  listDepartmentsForUser,
  updateDepartmentForUser,
} from "@/actions/departments";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("department management authorization (real database)", () => {
  let adminUserId: string;
  let patientUserId: string;
  const createdDepartmentIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword("test-password-123");
    const stamp = Date.now();

    const admin = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: `test-dept-admin-${stamp}@example.com`,
        passwordHash,
      },
    });
    adminUserId = admin.id;

    const patient = await prisma.user.create({
      data: {
        name: "Test Patient",
        email: `test-dept-patient-${stamp}@example.com`,
        passwordHash,
      },
    });
    patientUserId = patient.id;
  });

  afterEach(async () => {
    if (createdDepartmentIds.length > 0) {
      await prisma.department.deleteMany({
        where: { id: { in: createdDepartmentIds } },
      });
      createdDepartmentIds.length = 0;
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

  it("allows a hospital admin to list departments", async () => {
    const departments = await listDepartmentsForUser(asAdmin());
    expect(Array.isArray(departments)).toBe(true);
    expect(departments.length).toBeGreaterThan(0); // seeded in Phase 0
  });

  it("rejects a patient listing departments", async () => {
    await expect(listDepartmentsForUser(asPatient())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows a hospital admin to create, update, and delete a department", async () => {
    const created = await createDepartmentForUser(asAdmin(), {
      name: `Test Department ${Date.now()}`,
      description: "Created by an integration test",
    });
    createdDepartmentIds.push(created.id);
    expect(created.name).toContain("Test Department");

    const updated = await updateDepartmentForUser(asAdmin(), created.id, {
      name: created.name,
      description: "Updated description",
    });
    expect(updated.description).toBe("Updated description");

    await deleteDepartmentForUser(asAdmin(), created.id);
    createdDepartmentIds.pop();

    const found = await prisma.department.findUnique({
      where: { id: created.id },
    });
    expect(found).toBeNull();
  });

  it("rejects a patient creating a department", async () => {
    await expect(
      createDepartmentForUser(asPatient(), { name: "Should not be created" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("writes an audit log entry when a department is created", async () => {
    const created = await createDepartmentForUser(asAdmin(), {
      name: `Audit Test Department ${Date.now()}`,
    });
    createdDepartmentIds.push(created.id);

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: adminUserId, entityId: created.id },
      orderBy: { createdAt: "desc" },
    });

    expect(entry).not.toBeNull();
    expect(entry?.action).toBe("CREATED_DEPARTMENT");
  });
});
