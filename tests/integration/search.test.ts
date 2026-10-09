import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requestAppointmentForUser } from "@/actions/appointments";
import { searchForUser } from "@/actions/search";
import { type SessionUser } from "@/lib/permissions";

describe("search: role-scoped results reusing existing authorization (real database)", () => {
  let adminUserId: string;
  let patientAUserId: string;
  let patientBUserId: string;
  let doctorAUserId: string;
  let doctorAProfileId: string;
  let doctorBUserId: string;
  let nurseUserId: string;
  let studentAUserId: string;
  let studentAProfileId: string;
  let appointmentId: string;
  let stampValue: number;
  const createdPlacementIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, studentRole, patientRole, doctorRole, nurseRole] =
      await Promise.all([
        hashPassword("test-password-123"),
        prisma.department.findFirstOrThrow(),
        prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } }),
        prisma.role.findUniqueOrThrow({ where: { name: "PATIENT" } }),
        prisma.role.findUniqueOrThrow({ where: { name: "DOCTOR" } }),
        prisma.role.findUniqueOrThrow({ where: { name: "NURSE" } }),
      ]);
    const stamp = Date.now();
    stampValue = stamp;
    const departmentId = department.id;

    const [admin, patientA, patientB, doctorA, doctorB, nurse, studentA] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: `Search Admin ${stamp}`,
            email: `test-search-admin-${stamp}@example.com`,
            passwordHash,
          },
        }),
        prisma.user.create({
          data: {
            name: `Search Patient A ${stamp}`,
            email: `test-search-patient-a-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: { create: { dateOfBirth: new Date("1990-01-01") } },
          },
        }),
        prisma.user.create({
          data: {
            name: `Search Patient B ${stamp}`,
            email: `test-search-patient-b-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: patientRole.id } },
            patientProfile: { create: { dateOfBirth: new Date("1991-01-01") } },
          },
        }),
        prisma.user.create({
          data: {
            name: `Search Doctor A ${stamp}`,
            email: `test-search-doctor-a-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: doctorRole.id } },
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-SEARCH-A-${stamp}`,
                canSupervise: true,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: `Search Doctor B ${stamp}`,
            email: `test-search-doctor-b-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: doctorRole.id } },
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-SEARCH-B-${stamp}`,
                canSupervise: true,
              },
            },
          },
        }),
        prisma.user.create({
          data: {
            name: `Search Nurse ${stamp}`,
            email: `test-search-nurse-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: nurseRole.id } },
            nurseProfile: { create: { departmentId } },
          },
        }),
        prisma.user.create({
          data: {
            name: `Search Student A ${stamp}`,
            email: `test-search-student-a-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-SEARCH-A-${stamp}`,
                university: "University of Testing",
                yearOfStudy: 3,
                program: "MBChB",
              },
            },
          },
          include: { studentProfile: true },
        }),
      ]);

    adminUserId = admin.id;
    patientAUserId = patientA.id;
    patientBUserId = patientB.id;
    doctorAUserId = doctorA.id;
    doctorAProfileId = doctorA.doctorProfile!.id;
    doctorBUserId = doctorB.id;
    nurseUserId = nurse.id;
    studentAUserId = studentA.id;
    studentAProfileId = studentA.studentProfile!.id;

    allUserIds.push(
      adminUserId,
      patientAUserId,
      patientBUserId,
      doctorAUserId,
      doctorBUserId,
      nurseUserId,
      studentAUserId,
    );

    const appointment = await requestAppointmentForUser(asPatientA(), {
      doctorId: doctorAProfileId,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      reason: "Search fixture appointment",
    });
    appointmentId = appointment.id;

    const placement = await prisma.studentPlacement.create({
      data: {
        studentId: studentAProfileId,
        departmentId,
        supervisorId: doctorAProfileId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: "ACTIVE",
      },
    });
    createdPlacementIds.push(placement.id);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: allUserIds } } });
    await prisma.studentPlacement.deleteMany({
      where: { id: { in: createdPlacementIds } },
    });
    await prisma.appointment.deleteMany({ where: { id: appointmentId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: allUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  });

  function stamp() {
    return stampValue;
  }

  function asAdmin(): SessionUser {
    return {
      id: adminUserId,
      name: "Search Admin",
      email: "admin@test",
      roles: ["HOSPITAL_ADMIN"],
      isActive: true,
    };
  }

  function asPatientA(): SessionUser {
    return {
      id: patientAUserId,
      name: "Search Patient A",
      email: "patient-a@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asDoctorA(): SessionUser {
    return {
      id: doctorAUserId,
      name: "Search Doctor A",
      email: "doctor-a@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asDoctorB(): SessionUser {
    return {
      id: doctorBUserId,
      name: "Search Doctor B",
      email: "doctor-b@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asNurse(): SessionUser {
    return {
      id: nurseUserId,
      name: "Search Nurse",
      email: "nurse@test",
      roles: ["NURSE"],
      isActive: true,
    };
  }

  function asStudentA(): SessionUser {
    return {
      id: studentAUserId,
      name: "Search Student A",
      email: "student-a@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  it("returns nothing for a query shorter than 2 characters", async () => {
    const results = await searchForUser(asAdmin(), "a");
    expect(results).toEqual([]);
  });

  it("admin search finds a matching patient under Patients, scoped to that query", async () => {
    const results = await searchForUser(asAdmin(), `Search Patient A ${stamp()}`);
    const patients = results.find((g) => g.category === "Patients");
    expect(patients?.items.some((i) => i.id === patientAUserId)).toBe(true);
    expect(patients?.items.some((i) => i.id === patientBUserId)).toBe(false);
  });

  it("admin search finds staff under Staff and students under Students", async () => {
    const [staffResults, studentResults] = await Promise.all([
      searchForUser(asAdmin(), `Search Doctor A ${stamp()}`),
      searchForUser(asAdmin(), `Search Student A ${stamp()}`),
    ]);
    const staff = staffResults.find((g) => g.category === "Staff");
    expect(staff?.items.some((i) => i.id === doctorAUserId)).toBe(true);

    const students = studentResults.find((g) => g.category === "Students");
    expect(students?.items.some((i) => i.id === studentAUserId)).toBe(true);
  });

  it("a nurse's search never includes Patients, Staff, or Students categories, only Appointments", async () => {
    const results = await searchForUser(asNurse(), `Search Patient A ${stamp()}`);
    expect(results.some((g) => g.category === "Patients")).toBe(false);
    expect(results.some((g) => g.category === "Staff")).toBe(false);
    expect(results.some((g) => g.category === "Students")).toBe(false);

    const appointments = results.find((g) => g.category === "Appointments");
    expect(appointments?.items.some((i) => i.id === appointmentId)).toBe(true);
  });

  it("a doctor's search surfaces their own supervised student under My Students", async () => {
    const results = await searchForUser(asDoctorA(), `Search Student A ${stamp()}`);
    const myStudents = results.find((g) => g.category === "My Students");
    expect(myStudents?.items.some((i) => i.id === studentAProfileId)).toBe(true);
  });

  it("a different doctor's search for that same student surfaces nothing at all", async () => {
    const results = await searchForUser(asDoctorB(), `Search Student A ${stamp()}`);
    expect(results).toHaveLength(0);
  });

  it("a patient's search surfaces doctors for booking and their own appointment", async () => {
    const results = await searchForUser(asPatientA(), `Search Doctor A ${stamp()}`);
    const doctors = results.find((g) => g.category === "Doctors");
    expect(doctors?.items.some((i) => i.id === doctorAProfileId)).toBe(true);

    const appointments = results.find((g) => g.category === "Appointments");
    expect(appointments?.items.some((i) => i.id === appointmentId)).toBe(true);
  });

  it("a student's search surfaces their own placement under My Placements", async () => {
    const results = await searchForUser(asStudentA(), `Search Doctor A ${stamp()}`);
    const placements = results.find((g) => g.category === "My Placements");
    expect(placements?.items.some((i) => i.id === createdPlacementIds[0])).toBe(true);
  });
});
