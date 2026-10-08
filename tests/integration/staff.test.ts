import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  createDoctorForUser,
  createNurseForUser,
  listStaffForUser,
} from "@/actions/staff";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("staff management authorization (real database)", () => {
  let adminUserId: string;
  let patientUserId: string;
  let departmentId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword("test-password-123");
    const stamp = Date.now();

    const admin = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: `test-staff-admin-${stamp}@example.com`,
        passwordHash,
      },
    });
    adminUserId = admin.id;

    const patient = await prisma.user.create({
      data: {
        name: "Test Patient",
        email: `test-staff-patient-${stamp}@example.com`,
        passwordHash,
      },
    });
    patientUserId = patient.id;

    const department = await prisma.department.findFirstOrThrow();
    departmentId = department.id;
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

  it("allows a hospital admin to create a doctor account with a profile", async () => {
    const stamp = Date.now();
    const doctor = await createDoctorForUser(asAdmin(), {
      name: "Dr. Test",
      email: `test-new-doctor-${stamp}@example.com`,
      password: "test-password-123",
      departmentId,
      specialization: "Cardiology",
      licenseNumber: `LIC-${stamp}`,
      canSupervise: true,
    });
    createdUserIds.push(doctor.id);

    const created = await prisma.user.findUniqueOrThrow({
      where: { id: doctor.id },
      include: {
        roles: { include: { role: true } },
        doctorProfile: true,
      },
    });

    expect(created.roles.map((r) => r.role.name)).toContain("DOCTOR");
    expect(created.doctorProfile?.specialization).toBe("Cardiology");
    expect(created.doctorProfile?.canSupervise).toBe(true);
  });

  it("allows a hospital admin to create a nurse account with a profile", async () => {
    const stamp = Date.now();
    const nurse = await createNurseForUser(asAdmin(), {
      name: "Nurse Test",
      email: `test-new-nurse-${stamp}@example.com`,
      password: "test-password-123",
      departmentId,
    });
    createdUserIds.push(nurse.id);

    const created = await prisma.user.findUniqueOrThrow({
      where: { id: nurse.id },
      include: {
        roles: { include: { role: true } },
        nurseProfile: true,
      },
    });

    expect(created.roles.map((r) => r.role.name)).toContain("NURSE");
    expect(created.nurseProfile?.departmentId).toBe(departmentId);
  });

  it("rejects a patient creating a doctor account", async () => {
    await expect(
      createDoctorForUser(asPatient(), {
        name: "Should not be created",
        email: `should-not-exist-${Date.now()}@example.com`,
        password: "test-password-123",
        departmentId,
        specialization: "Cardiology",
        licenseNumber: "LIC-000",
        canSupervise: false,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects creating a duplicate email", async () => {
    const stamp = Date.now();
    const email = `test-duplicate-${stamp}@example.com`;

    const first = await createNurseForUser(asAdmin(), {
      name: "First Nurse",
      email,
      password: "test-password-123",
      departmentId,
    });
    createdUserIds.push(first.id);

    await expect(
      createNurseForUser(asAdmin(), {
        name: "Second Nurse",
        email,
        password: "test-password-123",
        departmentId,
      }),
    ).rejects.toThrow("already exists");
  });

  it("rejects a patient listing staff", async () => {
    await expect(listStaffForUser(asPatient())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("lists created staff for a hospital admin", async () => {
    const stamp = Date.now();
    const nurse = await createNurseForUser(asAdmin(), {
      name: "Listed Nurse",
      email: `test-listed-${stamp}@example.com`,
      password: "test-password-123",
      departmentId,
    });
    createdUserIds.push(nurse.id);

    const staff = await listStaffForUser(asAdmin());
    expect(staff.some((member) => member.id === nurse.id)).toBe(true);
  });
});
