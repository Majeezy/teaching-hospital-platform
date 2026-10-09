import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  listAppointmentsForUser,
  requestAppointmentForUser,
  updateAppointmentStatusForUser,
} from "@/actions/appointments";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("appointments authorization and lifecycle (real database)", () => {
  let adminUserId: string;
  let patientAUserId: string;
  let patientAProfileId: string;
  let patientBUserId: string;
  let doctorAUserId: string;
  let doctorAProfileId: string;
  let doctorBUserId: string;
  let nurseUserId: string;
  let departmentId: string;
  const createdAppointmentIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, patientRole] = await Promise.all([
      hashPassword("test-password-123"),
      prisma.department.findFirstOrThrow(),
      prisma.role.findUniqueOrThrow({ where: { name: "PATIENT" } }),
    ]);
    const stamp = Date.now();
    departmentId = department.id;

    // Independent creates -- no row depends on another, so run them
    // concurrently rather than waiting on six sequential network
    // round-trips to Neon.
    const [admin, patientA, patientB, doctorA, doctorB, nurse] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Test Admin",
            email: `test-appt-admin-${stamp}@example.com`,
            passwordHash,
          },
        }),
        prisma.user.create({
          data: {
            name: "Patient A",
            email: `test-appt-patient-a-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: {
              create: { dateOfBirth: new Date("1990-01-01") },
            },
          },
          include: { patientProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Patient B",
            email: `test-appt-patient-b-${stamp}@example.com`,
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
            email: `test-appt-doctor-a-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-A-${stamp}`,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Doctor B",
            email: `test-appt-doctor-b-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-B-${stamp}`,
              },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: "Test Nurse",
            email: `test-appt-nurse-${stamp}@example.com`,
            passwordHash,
            nurseProfile: { create: { departmentId } },
          },
        }),
      ]);

    adminUserId = admin.id;
    patientAUserId = patientA.id;
    patientAProfileId = patientA.patientProfile!.id;
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
  });

  afterAll(async () => {
    if (createdAppointmentIds.length > 0) {
      await prisma.appointment.deleteMany({
        where: { id: { in: createdAppointmentIds } },
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

  function futureDate(hoursFromNow: number) {
    return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
  }

  it("rejects booking an appointment in the past", async () => {
    await expect(
      requestAppointmentForUser(asPatientA(), {
        doctorId: doctorAProfileId,
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    ).rejects.toThrow("must be in the future");
  });

  it("lets a patient request an appointment with a specific doctor", async () => {
    const appointment = await requestAppointmentForUser(asPatientA(), {
      doctorId: doctorAProfileId,
      scheduledAt: futureDate(24),
      reason: "Annual checkup",
    });
    createdAppointmentIds.push(appointment.id);

    expect(appointment.status).toBe("SCHEDULED");
    expect(appointment.patientId).toBe(patientAProfileId);
    expect(appointment.doctorId).toBe(doctorAProfileId);
    expect(appointment.departmentId).toBe(departmentId); // derived from doctor
  });

  it("scopes the appointment list correctly per role", async () => {
    const [adminView, doctorAView, doctorBView, nurseView, patientAView, patientBView] =
      await Promise.all([
        listAppointmentsForUser(asAdmin()),
        listAppointmentsForUser(asDoctorA()),
        listAppointmentsForUser(asDoctorB()),
        listAppointmentsForUser(asNurse()),
        listAppointmentsForUser(asPatientA()),
        listAppointmentsForUser(asPatientB()),
      ]);

    const appointmentId = createdAppointmentIds[0];
    expect(adminView.some((a) => a.id === appointmentId)).toBe(true);
    expect(doctorAView.some((a) => a.id === appointmentId)).toBe(true);
    expect(doctorBView.some((a) => a.id === appointmentId)).toBe(false);
    expect(nurseView.some((a) => a.id === appointmentId)).toBe(true); // same department
    expect(patientAView.some((a) => a.id === appointmentId)).toBe(true);
    expect(patientBView.some((a) => a.id === appointmentId)).toBe(false);
  });

  it("rejects an invalid status transition (skipping steps)", async () => {
    const appointmentId = createdAppointmentIds[0];
    await expect(
      updateAppointmentStatusForUser(asAdmin(), appointmentId, "COMPLETED"),
    ).rejects.toThrow("Cannot move an appointment");
  });

  it("rejects a different doctor confirming someone else's appointment", async () => {
    const appointmentId = createdAppointmentIds[0];
    await expect(
      updateAppointmentStatusForUser(asDoctorB(), appointmentId, "CONFIRMED"),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects a patient confirming their own appointment (clinical step, not patient-initiated)", async () => {
    const appointmentId = createdAppointmentIds[0];
    await expect(
      updateAppointmentStatusForUser(asPatientA(), appointmentId, "CONFIRMED"),
    ).rejects.toThrow(AuthorizationError);
  });

  it("walks a full lifecycle: confirm -> start -> complete", async () => {
    const appointmentId = createdAppointmentIds[0];

    const confirmed = await updateAppointmentStatusForUser(
      asDoctorA(),
      appointmentId,
      "CONFIRMED",
    );
    expect(confirmed.status).toBe("CONFIRMED");

    const started = await updateAppointmentStatusForUser(
      asAdmin(),
      appointmentId,
      "IN_PROGRESS",
    );
    expect(started.status).toBe("IN_PROGRESS");

    const completed = await updateAppointmentStatusForUser(
      asDoctorA(),
      appointmentId,
      "COMPLETED",
    );
    expect(completed.status).toBe("COMPLETED");

    const entry = await prisma.auditLog.findFirst({
      where: { entityId: appointmentId, action: "APPOINTMENT_STATUS_COMPLETED" },
    });
    expect(entry).not.toBeNull();
  });

  it("rejects transitions once an appointment is in a terminal state", async () => {
    const appointmentId = createdAppointmentIds[0];
    await expect(
      updateAppointmentStatusForUser(asAdmin(), appointmentId, "CANCELLED"),
    ).rejects.toThrow("Cannot move an appointment");
  });

  it("lets a patient cancel their own upcoming appointment", async () => {
    const appointment = await requestAppointmentForUser(asPatientA(), {
      doctorId: doctorAProfileId,
      scheduledAt: futureDate(48),
    });
    createdAppointmentIds.push(appointment.id);

    const cancelled = await updateAppointmentStatusForUser(
      asPatientA(),
      appointment.id,
      "CANCELLED",
    );
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("rejects a patient cancelling someone else's appointment", async () => {
    const appointment = await requestAppointmentForUser(asPatientA(), {
      doctorId: doctorAProfileId,
      scheduledAt: futureDate(72),
    });
    createdAppointmentIds.push(appointment.id);

    await expect(
      updateAppointmentStatusForUser(asPatientB(), appointment.id, "CANCELLED"),
    ).rejects.toThrow(AuthorizationError);
  });
});
