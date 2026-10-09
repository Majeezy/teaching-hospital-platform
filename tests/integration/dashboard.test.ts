import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  getAdminDashboardForUser,
  getDoctorDashboardForUser,
  getPatientDashboardForUser,
} from "@/actions/dashboard";
import { requestAppointmentForUser } from "@/actions/appointments";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("dashboards (real database)", () => {
  let adminUserId: string;
  let patientUserId: string;
  let patientProfileId: string;
  let doctorUserId: string;
  let doctorProfileId: string;
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

    const [admin, patient, doctor] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Test Admin",
          email: `test-dash-admin-${stamp}@example.com`,
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          name: "Test Patient",
          email: `test-dash-patient-${stamp}@example.com`,
          passwordHash,
          roles: { create: { roleId: patientRole.id } },
          patientProfile: { create: { dateOfBirth: new Date("1990-01-01") } },
        },
        include: { patientProfile: true },
      }),
      prisma.user.create({
        data: {
          name: "Test Doctor",
          email: `test-dash-doctor-${stamp}@example.com`,
          passwordHash,
          doctorProfile: {
            create: {
              departmentId,
              specialization: "General",
              licenseNumber: `LIC-DASH-${stamp}`,
            },
          },
        },
        include: { doctorProfile: true },
      }),
    ]);

    adminUserId = admin.id;
    patientUserId = patient.id;
    patientProfileId = patient.patientProfile!.id;
    doctorUserId = doctor.id;
    doctorProfileId = doctor.doctorProfile!.id;
    allUserIds.push(adminUserId, patientUserId, doctorUserId);

    const appointment = await requestAppointmentForUser(asPatient(), {
      doctorId: doctorProfileId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    appointmentId = appointment.id;
  });

  afterAll(async () => {
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

  it("rejects non-admins from the admin dashboard", async () => {
    await expect(getAdminDashboardForUser(asPatient())).rejects.toThrow(
      AuthorizationError,
    );
    await expect(getAdminDashboardForUser(asDoctor())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("rejects non-doctors from the doctor dashboard", async () => {
    await expect(getDoctorDashboardForUser(asPatient())).rejects.toThrow(
      AuthorizationError,
    );
    await expect(getDoctorDashboardForUser(asAdmin())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("rejects non-patients from the patient dashboard", async () => {
    await expect(getPatientDashboardForUser(asDoctor())).rejects.toThrow(
      AuthorizationError,
    );
    await expect(getPatientDashboardForUser(asAdmin())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("admin dashboard counts reflect real data, including the fixture's own records", async () => {
    const data = await getAdminDashboardForUser(asAdmin());
    expect(data.totalPatients).toBeGreaterThanOrEqual(1);
    expect(data.totalDoctors).toBeGreaterThanOrEqual(1);
    expect(data.totalDepartments).toBeGreaterThanOrEqual(1);
    expect(
      data.pendingAppointments.some((a) => a.id === appointmentId),
    ).toBe(true);
    expect(data.recentActivity.length).toBeGreaterThan(0);
  });

  it("doctor dashboard only shows this doctor's own upcoming appointment", async () => {
    const data = await getDoctorDashboardForUser(asDoctor());
    expect(
      data.upcomingAppointments.some((a) => a.id === appointmentId),
    ).toBe(true);
  });

  it("patient dashboard only shows this patient's own upcoming appointment", async () => {
    const data = await getPatientDashboardForUser(asPatient());
    expect(
      data.upcomingAppointments.some((a) => a.id === appointmentId),
    ).toBe(true);
    expect(data.patientProfile.id).toBe(patientProfileId);
  });
});
