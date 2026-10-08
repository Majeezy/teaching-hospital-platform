import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  getMyProfileForUser,
  listPatientsForUser,
  updateMyProfileForUser,
} from "@/actions/patients";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("patient management authorization (real database)", () => {
  let adminUserId: string;
  let patientUserId: string;
  let doctorUserId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("test-password-123");
    const stamp = Date.now();

    const admin = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: `test-patients-admin-${stamp}@example.com`,
        passwordHash,
      },
    });
    adminUserId = admin.id;

    const patientRole = await prisma.role.findUniqueOrThrow({
      where: { name: "PATIENT" },
    });

    const patient = await prisma.user.create({
      data: {
        name: "Test Patient",
        email: `test-patients-patient-${stamp}@example.com`,
        passwordHash,
        roles: { create: { roleId: patientRole.id } },
        patientProfile: {
          create: {
            dateOfBirth: new Date("1990-01-01"),
            bloodType: "O+",
            allergies: ["Penicillin"],
          },
        },
      },
    });
    patientUserId = patient.id;

    const department = await prisma.department.findFirstOrThrow();
    const doctor = await prisma.user.create({
      data: {
        name: "Test Doctor",
        email: `test-patients-doctor-${stamp}@example.com`,
        passwordHash,
        doctorProfile: {
          create: {
            departmentId: department.id,
            specialization: "General",
            licenseNumber: `LIC-${stamp}`,
          },
        },
      },
    });
    doctorUserId = doctor.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, patientUserId, doctorUserId] } },
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

  function asDoctor(): SessionUser {
    return {
      id: doctorUserId,
      name: "Test Doctor",
      email: "doctor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  it("allows a hospital admin to list patients", async () => {
    const patients = await listPatientsForUser(asAdmin());
    expect(patients.some((p) => p.id === patientUserId)).toBe(true);
  });

  it("rejects a doctor listing patients directly (no appointment-based scoping yet)", async () => {
    await expect(listPatientsForUser(asDoctor())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("lets a patient read their own profile", async () => {
    const profile = await getMyProfileForUser(asPatient());
    expect(profile.bloodType).toBe("O+");
    expect(profile.allergies).toEqual(["Penicillin"]);
  });

  it("rejects a non-patient reading a patient profile via getMyProfile", async () => {
    await expect(getMyProfileForUser(asAdmin())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("lets a patient update their own profile, including allergies", async () => {
    const updated = await updateMyProfileForUser(asPatient(), {
      contactPhone: "+27123456789",
      emergencyContact: "Jane Doe, +27987654321",
      bloodType: "AB-",
      allergies: ["Penicillin", "Peanuts"],
    });

    expect(updated.contactPhone).toBe("+27123456789");
    expect(updated.bloodType).toBe("AB-");
    expect(updated.allergies).toEqual(["Penicillin", "Peanuts"]);
  });

  it("clears optional fields when submitted empty", async () => {
    const updated = await updateMyProfileForUser(asPatient(), {
      contactPhone: "",
      emergencyContact: "",
      bloodType: "",
      allergies: [],
    });

    expect(updated.contactPhone).toBeNull();
    expect(updated.emergencyContact).toBeNull();
    expect(updated.bloodType).toBeNull();
    expect(updated.allergies).toEqual([]);
  });

  it("rejects a doctor updating a patient profile through updateMyProfile", async () => {
    await expect(
      updateMyProfileForUser(asDoctor(), { allergies: [] }),
    ).rejects.toThrow(AuthorizationError);
  });
});
