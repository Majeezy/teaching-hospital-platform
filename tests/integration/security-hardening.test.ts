import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  deactivateUserForUser,
  resetPasswordForUser,
} from "@/actions/users";
import {
  getAppointmentForUser,
  requestAppointmentForUser,
  updateAppointmentStatusForUser,
} from "@/actions/appointments";
import { registerPatient } from "@/actions/auth";
import { listEligibleRecipientsForUser } from "@/actions/messages";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("Phase 4 Stage 2 security hardening fixes (real database)", () => {
  let adminAUserId: string;
  let adminBUserId: string;
  let patientUserId: string;
  let doctorUserId: string;
  let inactiveDoctorProfileId: string;
  let inactiveDoctorUserId: string;
  let dualRoleUserId: string;
  let dualRoleDoctorProfileId: string;
  let dualRolePatientOfDoctorUserId: string;
  const createdAppointmentIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, patientRole, doctorRole] = await Promise.all([
      hashPassword("test-password-123"),
      prisma.department.findFirstOrThrow(),
      prisma.role.findUniqueOrThrow({ where: { name: "PATIENT" } }),
      prisma.role.findUniqueOrThrow({ where: { name: "DOCTOR" } }),
    ]);
    const stamp = Date.now();
    const departmentId = department.id;

    const [adminA, adminB, patient, doctor, inactiveDoctor, dualRoleUser, dualPatient] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Security Admin A",
            email: `test-sec-admin-a-${stamp}@example.com`,
            passwordHash,
            roles: {
              create: {
                roleId: (await prisma.role.findUniqueOrThrow({
                  where: { name: "HOSPITAL_ADMIN" },
                })).id,
              },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: "Security Admin B",
            email: `test-sec-admin-b-${stamp}@example.com`,
            passwordHash,
            roles: {
              create: {
                roleId: (await prisma.role.findUniqueOrThrow({
                  where: { name: "HOSPITAL_ADMIN" },
                })).id,
              },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: "Security Patient",
            email: `test-sec-patient-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: { create: { dateOfBirth: new Date("1990-01-01") } },
          },
          include: { patientProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Security Doctor",
            email: `test-sec-doctor-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: doctorRole.id } },
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-SEC-${stamp}`,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Inactive Doctor",
            email: `test-sec-inactive-doctor-${stamp}@example.com`,
            passwordHash,
            isActive: false,
            roles: { create: { roleId: doctorRole.id } },
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-SEC-INACTIVE-${stamp}`,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Dual Role Doctor-Patient",
            email: `test-sec-dualrole-${stamp}@example.com`,
            passwordHash,
            roles: {
              create: [{ roleId: doctorRole.id }, { roleId: patientRole.id }],
            },
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-SEC-DUAL-${stamp}`,
              },
            },
            patientProfile: { create: { dateOfBirth: new Date("1985-01-01") } },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Patient Of Dual Role Doctor",
            email: `test-sec-dual-patient-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: { create: { dateOfBirth: new Date("1992-01-01") } },
          },
          include: { patientProfile: true },
        }),
      ]);

    adminAUserId = adminA.id;
    adminBUserId = adminB.id;
    patientUserId = patient.id;
    doctorUserId = doctor.id;
    inactiveDoctorUserId = inactiveDoctor.id;
    inactiveDoctorProfileId = inactiveDoctor.doctorProfile!.id;
    dualRoleUserId = dualRoleUser.id;
    dualRoleDoctorProfileId = dualRoleUser.doctorProfile!.id;
    dualRolePatientOfDoctorUserId = dualPatient.id;

    allUserIds.push(
      adminAUserId,
      adminBUserId,
      patientUserId,
      doctorUserId,
      inactiveDoctorUserId,
      dualRoleUserId,
      dualRolePatientOfDoctorUserId,
    );

    // The dual-role user, as a doctor, needs an appointment with their
    // own patient so the "own patients" branch of messaging has
    // something real to surface.
    const dualRoleAppointment = await requestAppointmentForUser(
      asDualRolePatient(),
      {
        doctorId: dualRoleDoctorProfileId,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        reason: "Dual-role fixture appointment",
      },
    );
    createdAppointmentIds.push(dualRoleAppointment.id);
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({
      where: { id: { in: createdAppointmentIds } },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: allUserIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: allUserIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: allUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  });

  function asAdminA(): SessionUser {
    return {
      id: adminAUserId,
      name: "Security Admin A",
      email: "admin-a@test",
      roles: ["HOSPITAL_ADMIN"],
      isActive: true,
    };
  }

  function asPatient(): SessionUser {
    return {
      id: patientUserId,
      name: "Security Patient",
      email: "patient@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asDoctor(): SessionUser {
    return {
      id: doctorUserId,
      name: "Security Doctor",
      email: "doctor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asDualRoleUser(): SessionUser {
    return {
      id: dualRoleUserId,
      name: "Dual Role Doctor-Patient",
      email: "dualrole@test",
      roles: ["DOCTOR", "PATIENT"],
      isActive: true,
    };
  }

  function asDualRolePatient(): SessionUser {
    return {
      id: dualRolePatientOfDoctorUserId,
      name: "Patient Of Dual Role Doctor",
      email: "dual-patient@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  it("rejects one admin deactivating another admin account", async () => {
    await expect(
      deactivateUserForUser(asAdminA(), adminBUserId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects one admin resetting another admin's password", async () => {
    await expect(
      resetPasswordForUser(asAdminA(), adminBUserId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("still allows an admin to deactivate a non-admin account", async () => {
    const updated = await deactivateUserForUser(asAdminA(), patientUserId);
    expect(updated.isActive).toBe(false);
    await prisma.user.update({
      where: { id: patientUserId },
      data: { isActive: true },
    });
  });

  it("throws the same AuthorizationError for a nonexistent appointment as for a forbidden one", async () => {
    const nonexistentError = await getAppointmentForUser(
      asPatient(),
      "nonexistent-appointment-id",
    ).catch((e) => e);
    expect(nonexistentError).toBeInstanceOf(AuthorizationError);

    // A real appointment this patient has no relationship to, for
    // the forbidden case to compare against.
    const forbiddenError = await getAppointmentForUser(
      asPatient(),
      createdAppointmentIds[0],
    ).catch((e) => e);
    expect(forbiddenError).toBeInstanceOf(AuthorizationError);

    // Same error constructor either way -- a caller can't use the
    // exception type to tell "doesn't exist" apart from "forbidden".
    expect(nonexistentError.constructor).toBe(forbiddenError.constructor);
  });

  it("throws AuthorizationError (not a raw Prisma error) for a nonexistent id in updateAppointmentStatusForUser", async () => {
    await expect(
      updateAppointmentStatusForUser(asDoctor(), "nonexistent-id", "CONFIRMED"),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects booking an inactive doctor", async () => {
    await expect(
      requestAppointmentForUser(asPatient(), {
        doctorId: inactiveDoctorProfileId,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).rejects.toThrow("not currently available");
  });

  it("returns a friendly error, not a raw constraint error, for a duplicate registration email", async () => {
    const email = `test-sec-dup-${Date.now()}@example.com`;
    const input = {
      name: "Duplicate Attempt",
      email,
      password: "password1234",
      dateOfBirth: "1990-01-01",
    };

    const first = await registerPatient(input);
    expect(first.success).toBe(true);

    const second = await registerPatient(input);
    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.error).toBe("An account with this email already exists.");
    }

    const created = await prisma.user.findUniqueOrThrow({ where: { email } });
    allUserIds.push(created.id);
  });

  it("gives a dual-role (doctor + patient) user the union of both roles' eligible recipients, not just one", async () => {
    const recipients = await listEligibleRecipientsForUser(asDualRoleUser());

    // From the PATIENT side: no appointment was created for the
    // dual-role user as a patient in this fixture, so nothing is
    // expected there -- the real assertion is the DOCTOR side below,
    // proving the old if/else-if would have dropped it entirely.
    expect(
      recipients.some((r) => r.userId === dualRolePatientOfDoctorUserId),
    ).toBe(true);
  });
});
