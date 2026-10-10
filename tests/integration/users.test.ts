import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  deactivateUserForUser,
  getCurrentUserForUser,
  listUsersForUser,
  resetPasswordForUser,
} from "@/actions/users";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("user management authorization (real database)", () => {
  let adminUserId: string;
  let patientUserId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("test-password-123");
    const stamp = Date.now();

    const admin = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: `test-admin-${stamp}@example.com`,
        passwordHash,
      },
    });
    adminUserId = admin.id;

    const patient = await prisma.user.create({
      data: {
        name: "Test Patient",
        email: `test-patient-${stamp}@example.com`,
        passwordHash,
      },
    });
    patientUserId = patient.id;
  });

  afterAll(async () => {
    // AuditLog.actorId has no cascade -- intentionally, so a user can't
    // erase their own trail by having their account removed. Clean up the
    // audit rows this test created first, then the users.
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

  it("allows a hospital admin to list users", async () => {
    const users = await listUsersForUser(asAdmin());
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });

  it("rejects a patient listing users", async () => {
    await expect(listUsersForUser(asPatient())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("lets any authenticated user read their own profile", async () => {
    const self = await getCurrentUserForUser(asPatient());
    expect(self.id).toBe(patientUserId);
  });

  it("allows a hospital admin to deactivate another user", async () => {
    const updated = await deactivateUserForUser(asAdmin(), patientUserId);
    expect(updated.isActive).toBe(false);
  });

  it("rejects a patient deactivating another user", async () => {
    await prisma.user.update({
      where: { id: patientUserId },
      data: { isActive: true },
    });
    await expect(
      deactivateUserForUser(asPatient(), adminUserId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("prevents an admin from deactivating their own account", async () => {
    await expect(
      deactivateUserForUser(asAdmin(), adminUserId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("writes an audit log entry when a user is deactivated", async () => {
    await deactivateUserForUser(asAdmin(), patientUserId);

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: adminUserId, entityId: patientUserId },
      orderBy: { createdAt: "desc" },
    });

    expect(entry).not.toBeNull();
    expect(entry?.action).toBe("DEACTIVATED_USER");
  });

  it("rejects a patient resetting another user's password", async () => {
    await expect(
      resetPasswordForUser(asPatient(), adminUserId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("prevents an admin from resetting their own password this way", async () => {
    await expect(
      resetPasswordForUser(asAdmin(), adminUserId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("lets an admin reset another user's password, invalidating the old one", async () => {
    const { temporaryPassword } = await resetPasswordForUser(
      asAdmin(),
      patientUserId,
    );
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(16);

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: patientUserId },
    });
    const oldPasswordStillWorks = await verifyPassword(
      "test-password-123",
      updated.passwordHash,
    );
    const newPasswordWorks = await verifyPassword(
      temporaryPassword,
      updated.passwordHash,
    );
    expect(oldPasswordStillWorks).toBe(false);
    expect(newPasswordWorks).toBe(true);
  });

  it("writes an audit log entry when a password is reset, without the plaintext", async () => {
    const { temporaryPassword } = await resetPasswordForUser(
      asAdmin(),
      patientUserId,
    );

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: adminUserId, entityId: patientUserId, action: "RESET_PASSWORD" },
      orderBy: { createdAt: "desc" },
    });

    expect(entry).not.toBeNull();
    expect(JSON.stringify(entry?.metadata ?? "")).not.toContain(
      temporaryPassword,
    );
  });
});
