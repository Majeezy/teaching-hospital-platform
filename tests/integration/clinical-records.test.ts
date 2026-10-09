import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  addClinicalNoteForUser,
  addDiagnosisForUser,
  addPrescriptionForUser,
  addTestOrderForUser,
  addTestResultForUser,
  getAppointmentRecordsForUser,
} from "@/actions/clinical-records";
import { requestAppointmentForUser } from "@/actions/appointments";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("clinical records authorization (real database)", () => {
  let adminUserId: string;
  let patientAUserId: string;
  let patientBUserId: string;
  let doctorAUserId: string;
  let doctorAProfileId: string;
  let doctorBUserId: string;
  let nurseUserId: string;
  let appointmentId: string;
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, patientRole] = await Promise.all([
      hashPassword("test-password-123"),
      prisma.department.findFirstOrThrow(),
      prisma.role.findUniqueOrThrow({ where: { name: "PATIENT" } }),
    ]);
    const stamp = Date.now();
    const departmentId = department.id;

    const [admin, patientA, patientB, doctorA, doctorB, nurse] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Test Admin",
            email: `test-cr-admin-${stamp}@example.com`,
            passwordHash,
          },
        }),
        prisma.user.create({
          data: {
            name: "Patient A",
            email: `test-cr-patient-a-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: {
              create: { dateOfBirth: new Date("1990-01-01") },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: "Patient B",
            email: `test-cr-patient-b-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: {
              create: { dateOfBirth: new Date("1992-01-01") },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: "Doctor A",
            email: `test-cr-doctor-a-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-CR-A-${stamp}`,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Doctor B",
            email: `test-cr-doctor-b-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-CR-B-${stamp}`,
              },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: "Test Nurse",
            email: `test-cr-nurse-${stamp}@example.com`,
            passwordHash,
            nurseProfile: { create: { departmentId } },
          },
        }),
      ]);

    adminUserId = admin.id;
    patientAUserId = patientA.id;
    patientBUserId = patientB.id;
    doctorAUserId = doctorA.id;
    doctorAProfileId = doctorA.doctorProfile!.id;
    doctorBUserId = doctorB.id;
    nurseUserId = nurse.id;
    allUserIds.push(
      adminUserId,
      patientAUserId,
      patientBUserId,
      doctorAUserId,
      doctorBUserId,
      nurseUserId,
    );

    const appointment = await requestAppointmentForUser(asPatientA(), {
      doctorId: doctorAProfileId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      reason: "Checkup",
    });
    appointmentId = appointment.id;
  });

  afterAll(async () => {
    await prisma.testResult.deleteMany({
      where: { testOrder: { appointmentId } },
    });
    await prisma.testOrder.deleteMany({ where: { appointmentId } });
    await prisma.prescription.deleteMany({ where: { appointmentId } });
    await prisma.diagnosis.deleteMany({ where: { appointmentId } });
    await prisma.clinicalNote.deleteMany({ where: { appointmentId } });
    await prisma.appointment.deleteMany({ where: { id: appointmentId } });
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

  function asPatientA(): SessionUser {
    return {
      id: patientAUserId,
      name: "Patient A",
      email: "patient-a@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asPatientB(): SessionUser {
    return {
      id: patientBUserId,
      name: "Patient B",
      email: "patient-b@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asDoctorA(): SessionUser {
    return {
      id: doctorAUserId,
      name: "Doctor A",
      email: "doctor-a@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asDoctorB(): SessionUser {
    return {
      id: doctorBUserId,
      name: "Doctor B",
      email: "doctor-b@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asNurse(): SessionUser {
    return {
      id: nurseUserId,
      name: "Test Nurse",
      email: "nurse@test",
      roles: ["NURSE"],
      isActive: true,
    };
  }

  it("lets the assigned doctor add a note, diagnosis, and prescription", async () => {
    const note = await addClinicalNoteForUser(asDoctorA(), {
      appointmentId,
      content: "Patient presents with mild symptoms.",
    });
    expect(note.authorId).toBe(doctorAUserId);

    const diagnosis = await addDiagnosisForUser(asDoctorA(), {
      appointmentId,
      description: "Common cold",
      icdCode: "J00",
    });
    expect(diagnosis.icdCode).toBe("J00");

    const prescription = await addPrescriptionForUser(asDoctorA(), {
      appointmentId,
      medication: "Paracetamol",
      dosage: "500mg",
      instructions: "Twice daily",
    });
    expect(prescription.medication).toBe("Paracetamol");
  });

  it("rejects a different doctor adding records to this appointment", async () => {
    await expect(
      addClinicalNoteForUser(asDoctorB(), {
        appointmentId,
        content: "Should not be allowed",
      }),
    ).rejects.toThrow("your own appointments");
  });

  it("rejects the admin adding clinical records (read-only/oversight only)", async () => {
    await expect(
      addClinicalNoteForUser(asAdmin(), {
        appointmentId,
        content: "Admin should not be able to do this",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects a patient adding clinical records", async () => {
    await expect(
      addDiagnosisForUser(asPatientA(), {
        appointmentId,
        description: "Self-diagnosis should not be allowed",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("lets the owning patient read their own appointment's records", async () => {
    const records = await getAppointmentRecordsForUser(
      asPatientA(),
      appointmentId,
    );
    expect(records.notes.length).toBeGreaterThan(0);
    expect(records.canEdit).toBe(false);
  });

  it("rejects a different patient reading these records", async () => {
    await expect(
      getAppointmentRecordsForUser(asPatientB(), appointmentId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("lets a same-department nurse read (but not edit) the records", async () => {
    const records = await getAppointmentRecordsForUser(
      asNurse(),
      appointmentId,
    );
    expect(records.notes.length).toBeGreaterThan(0);
    expect(records.canEdit).toBe(false);
  });

  it("lets the admin read (oversight) but canEdit is false", async () => {
    const records = await getAppointmentRecordsForUser(
      asAdmin(),
      appointmentId,
    );
    expect(records.diagnoses.length).toBeGreaterThan(0);
    expect(records.canEdit).toBe(false);
  });

  it("orders a test, rejects a result from the wrong doctor, then records it correctly", async () => {
    const order = await addTestOrderForUser(asDoctorA(), {
      appointmentId,
      testType: "Full Blood Count",
    });
    expect(order.status).toBe("ORDERED");

    await expect(
      addTestResultForUser(asDoctorB(), {
        testOrderId: order.id,
        result: "Should not be allowed",
      }),
    ).rejects.toThrow("your own patients");

    const result = await addTestResultForUser(asDoctorA(), {
      testOrderId: order.id,
      result: "All values within normal range.",
    });
    expect(result.reviewedById).toBe(doctorAUserId);

    const updatedOrder = await prisma.testOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updatedOrder.status).toBe("COMPLETED");

    const auditEntry = await prisma.auditLog.findFirst({
      where: { actorId: doctorAUserId, action: "RECORDED_TEST_RESULT" },
    });
    expect(auditEntry).not.toBeNull();
  });
});
