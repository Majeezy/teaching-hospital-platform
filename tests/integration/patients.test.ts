import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  deleteMyDataForUser,
  exportMyDataForUser,
  getMyProfileForUser,
  listPatientsForUser,
  updateMyProfileForUser,
} from "@/actions/patients";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("patient management authorization (real database)", () => {
  let adminUserId: string;
  let patientUserId: string;
  let doctorUserId: string;
  let secondPatientUserId: string;
  let departmentId: string;

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
    departmentId = department.id;
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

    const secondPatient = await prisma.user.create({
      data: {
        name: "Other Patient",
        email: `test-patients-other-${stamp}@example.com`,
        passwordHash,
        roles: { create: { roleId: patientRole.id } },
        patientProfile: {
          create: { dateOfBirth: new Date("1985-05-05") },
        },
      },
    });
    secondPatientUserId = secondPatient.id;
  });

  afterAll(async () => {
    // FK-safe order: clinical records/appointments before the users they
    // reference, same reasoning as tests/e2e/fixtures.ts's cleanup.
    const patientProfileIds = await prisma.patientProfile.findMany({
      where: { userId: { in: [patientUserId, secondPatientUserId] } },
      select: { id: true },
    });
    const profileIds = patientProfileIds.map((p) => p.id);
    await prisma.testOrder.deleteMany({ where: { patientId: { in: profileIds } } });
    await prisma.prescription.deleteMany({ where: { patientId: { in: profileIds } } });
    await prisma.diagnosis.deleteMany({ where: { patientId: { in: profileIds } } });
    await prisma.clinicalNote.deleteMany({ where: { patientId: { in: profileIds } } });
    await prisma.document.deleteMany({ where: { patientId: { in: profileIds } } });
    await prisma.appointment.deleteMany({ where: { patientId: { in: profileIds } } });
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: [patientUserId, secondPatientUserId, doctorUserId] } },
          { recipientId: { in: [patientUserId, secondPatientUserId, doctorUserId] } },
        ],
      },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: [patientUserId, secondPatientUserId] } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [adminUserId, patientUserId, secondPatientUserId] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUserId, patientUserId, doctorUserId, secondPatientUserId] },
      },
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

  it("rejects a non-patient exporting data via exportMyData", async () => {
    await expect(exportMyDataForUser(asAdmin())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("exports the patient's own records, messages, and documents, but never another patient's", async () => {
    const profile = await prisma.patientProfile.findUniqueOrThrow({
      where: { userId: patientUserId },
    });
    const otherProfile = await prisma.patientProfile.findUniqueOrThrow({
      where: { userId: secondPatientUserId },
    });

    const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
      where: { userId: doctorUserId },
    });

    const [appointment, otherAppointment] = await Promise.all([
      prisma.appointment.create({
        data: {
          patientId: profile.id,
          doctorId: doctorProfile.id,
          departmentId,
          scheduledAt: new Date(),
          reason: "Export test checkup",
        },
      }),
      prisma.appointment.create({
        data: {
          patientId: otherProfile.id,
          doctorId: doctorProfile.id,
          departmentId,
          scheduledAt: new Date(),
          reason: "Other patient's appointment -- must never appear in the export",
        },
      }),
    ]);

    await prisma.clinicalNote.create({
      data: {
        patientId: profile.id,
        appointmentId: appointment.id,
        authorId: doctorUserId,
        content: "Export test note",
      },
    });
    await prisma.document.create({
      data: {
        patientId: profile.id,
        uploadedById: patientUserId,
        fileUrl: "https://example.test/export-test.pdf",
        fileName: "export-test.pdf",
        sizeBytes: 1024,
        type: "application/pdf",
      },
    });
    await prisma.message.create({
      data: {
        senderId: doctorUserId,
        recipientId: patientUserId,
        subject: "Export test message",
        body: "This should appear in the export.",
      },
    });
    await prisma.notification.create({
      data: {
        userId: patientUserId,
        type: "TEST",
        title: "Export test notification",
        body: "This should appear in the export.",
      },
    });

    const exported = await exportMyDataForUser(asPatient());

    expect(exported.id).toBe(patientUserId);
    expect(
      exported.patientProfile?.appointments.some((a) => a.id === appointment.id),
    ).toBe(true);
    expect(
      exported.patientProfile?.clinicalNotes.some(
        (n) => n.content === "Export test note",
      ),
    ).toBe(true);
    expect(
      exported.patientProfile?.documents.some(
        (d) => d.fileName === "export-test.pdf",
      ),
    ).toBe(true);
    expect(
      exported.receivedMessages.some(
        (m) => m.subject === "Export test message",
      ),
    ).toBe(true);
    expect(
      exported.notifications.some(
        (n) => n.title === "Export test notification",
      ),
    ).toBe(true);

    // Never contains the other patient's appointment -- proves this is
    // scoped to the caller's own data, not every appointment in the DB.
    expect(
      exported.patientProfile?.appointments.some(
        (a) => a.id === otherAppointment.id,
      ),
    ).toBe(false);
    expect(JSON.stringify(exported)).not.toContain("Other patient's appointment");
  });

  it("anonymizes and deactivates the account on delete, keeping clinical records intact, with an audit entry", async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: patientUserId },
    });
    const recordCountBefore = await prisma.clinicalNote.count({
      where: { patient: { userId: patientUserId } },
    });

    await deleteMyDataForUser(asPatient());

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: patientUserId },
      include: { patientProfile: true },
    });

    expect(after.name).toBe("Deleted Patient");
    expect(after.email).not.toBe(before.email);
    expect(after.email).toContain("deleted-");
    expect(after.isActive).toBe(false);
    expect(after.patientProfile?.contactPhone).toBeNull();
    expect(after.patientProfile?.emergencyContact).toBeNull();
    expect(after.patientProfile?.allergies).toEqual([]);

    const recordCountAfter = await prisma.clinicalNote.count({
      where: { patient: { userId: patientUserId } },
    });
    expect(recordCountAfter).toBe(recordCountBefore);

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: patientUserId, action: "DELETED_OWN_DATA" },
      orderBy: { createdAt: "desc" },
    });
    expect(entry).not.toBeNull();
  });
});
