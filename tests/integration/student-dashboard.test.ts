import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  getDoctorDashboardForUser,
  getStudentDashboardForUser,
} from "@/actions/dashboard";
import {
  requestAppointmentForUser,
  updateAppointmentStatusForUser,
} from "@/actions/appointments";
import {
  assignActivityForUser,
  submitReflectionForUser,
} from "@/actions/learning-activities";
import { recordAssessmentForUser } from "@/actions/competencies";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("student dashboard and doctor-supervisor dashboard extension (real database)", () => {
  let patientUserId: string;
  let supervisorUserId: string;
  let supervisorProfileId: string;
  let nonSupervisorDoctorUserId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let completedAppointmentId: string;
  let upcomingAppointmentId: string;
  let pendingActivityId: string;
  let completedActivityId: string;
  let competencyId: string;
  const createdPlacementIds: string[] = [];
  const createdAppointmentIds: string[] = [];
  const createdActivityIds: string[] = [];
  const allUserIds: string[] = [];

  // This fixture chains an unusually long sequence of sequential,
  // dependent mutations (appointment status transitions, then activity
  // assign/reflect, then an assessment) that can't be parallelized --
  // each step's authorization check depends on the previous one's
  // result. The global 20s hookTimeout isn't enough for that many
  // sequential round trips to Neon.
  beforeAll(async () => {
    const [passwordHash, department, studentRole, patientRole, competency] =
      await Promise.all([
        hashPassword("test-password-123"),
        prisma.department.findFirstOrThrow(),
        prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } }),
        prisma.role.findUniqueOrThrow({ where: { name: "PATIENT" } }),
        prisma.competency.findFirstOrThrow(),
      ]);
    const stamp = Date.now();
    const departmentId = department.id;
    competencyId = competency.id;

    const [patient, supervisor, nonSupervisorDoctor, student] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Dashboard Patient",
          email: `test-stu-dash-patient-${stamp}@example.com`,
          passwordHash,
          roles: { create: { roleId: patientRole.id } },
          patientProfile: { create: { dateOfBirth: new Date("1990-01-01") } },
        },
      }),
      prisma.user.create({
        data: {
          name: "Dashboard Supervisor",
          email: `test-stu-dash-supervisor-${stamp}@example.com`,
          passwordHash,
          doctorProfile: {
            create: {
              departmentId,
              specialization: "General",
              licenseNumber: `LIC-STUDASH-SUP-${stamp}`,
              canSupervise: true,
            },
          },
        },
        include: { doctorProfile: true },
      }),
      prisma.user.create({
        data: {
          name: "Non-Supervisor Doctor",
          email: `test-stu-dash-nonsup-${stamp}@example.com`,
          passwordHash,
          doctorProfile: {
            create: {
              departmentId,
              specialization: "General",
              licenseNumber: `LIC-STUDASH-NOSUP-${stamp}`,
              canSupervise: false,
            },
          },
        },
      }),
      prisma.user.create({
        data: {
          name: "Dashboard Student",
          email: `test-stu-dash-student-${stamp}@example.com`,
          passwordHash,
          roles: { create: { roleId: studentRole.id } },
          studentProfile: {
            create: {
              studentNumber: `STU-DASH-${stamp}`,
              university: "University of Testing",
              yearOfStudy: 3,
              program: "MBChB",
            },
          },
        },
        include: { studentProfile: true },
      }),
    ]);

    patientUserId = patient.id;
    supervisorUserId = supervisor.id;
    supervisorProfileId = supervisor.doctorProfile!.id;
    nonSupervisorDoctorUserId = nonSupervisorDoctor.id;
    studentUserId = student.id;
    studentProfileId = student.studentProfile!.id;

    allUserIds.push(
      patientUserId,
      supervisorUserId,
      nonSupervisorDoctorUserId,
      studentUserId,
    );

    const placement = await prisma.studentPlacement.create({
      data: {
        studentId: studentProfileId,
        departmentId,
        supervisorId: supervisorProfileId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: "ACTIVE",
      },
    });
    createdPlacementIds.push(placement.id);

    const [completedAppointment, upcomingAppointment] = await Promise.all([
      requestAppointmentForUser(asPatient(), {
        doctorId: supervisorProfileId,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        reason: "Will be completed and shadowed",
      }),
      requestAppointmentForUser(asPatient(), {
        doctorId: supervisorProfileId,
        scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        reason: "Still upcoming, shadowed",
      }),
    ]);
    completedAppointmentId = completedAppointment.id;
    upcomingAppointmentId = upcomingAppointment.id;
    createdAppointmentIds.push(completedAppointmentId, upcomingAppointmentId);

    await prisma.shadowingAssignment.createMany({
      data: [
        { appointmentId: completedAppointmentId, studentId: studentProfileId },
        { appointmentId: upcomingAppointmentId, studentId: studentProfileId },
      ],
    });

    await updateAppointmentStatusForUser(asSupervisor(), completedAppointmentId, "CONFIRMED");
    await updateAppointmentStatusForUser(asSupervisor(), completedAppointmentId, "IN_PROGRESS");
    await updateAppointmentStatusForUser(asSupervisor(), completedAppointmentId, "COMPLETED");

    const pendingActivity = await assignActivityForUser(asSupervisor(), {
      studentId: studentProfileId,
      title: "Pending activity",
      description: "Not yet reflected on.",
      dueDate: new Date().toISOString(),
    });
    pendingActivityId = pendingActivity.id;
    createdActivityIds.push(pendingActivityId);

    const completedActivity = await assignActivityForUser(asSupervisor(), {
      studentId: studentProfileId,
      title: "Awaiting feedback activity",
      description: "Reflection submitted, awaiting supervisor review.",
    });
    completedActivityId = completedActivity.id;
    createdActivityIds.push(completedActivityId);
    await submitReflectionForUser(asStudent(), {
      learningActivityId: completedActivityId,
      content: "I observed the consultation closely.",
    });

    await recordAssessmentForUser(asSupervisor(), {
      studentId: studentProfileId,
      competencyId,
      score: 4,
    });
  }, 45000);

  afterAll(async () => {
    await prisma.competencyAssessment.deleteMany({
      where: { studentCompetency: { studentId: studentProfileId } },
    });
    await prisma.studentCompetency.deleteMany({
      where: { studentId: studentProfileId },
    });
    await prisma.feedback.deleteMany({
      where: { relatedActivityId: { in: createdActivityIds } },
    });
    await prisma.studentReflection.deleteMany({
      where: { learningActivityId: { in: createdActivityIds } },
    });
    await prisma.learningActivity.deleteMany({
      where: { id: { in: createdActivityIds } },
    });
    await prisma.clinicalLogbookEntry.deleteMany({
      where: { relatedAppointmentId: { in: createdAppointmentIds } },
    });
    await prisma.shadowingAssignment.deleteMany({
      where: { appointmentId: { in: createdAppointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: createdAppointmentIds } },
    });
    await prisma.studentPlacement.deleteMany({
      where: { id: { in: createdPlacementIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: allUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  });

  function asPatient(): SessionUser {
    return {
      id: patientUserId,
      name: "Dashboard Patient",
      email: "patient@test",
      roles: ["PATIENT"],
      isActive: true,
    };
  }

  function asSupervisor(): SessionUser {
    return {
      id: supervisorUserId,
      name: "Dashboard Supervisor",
      email: "supervisor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asNonSupervisorDoctor(): SessionUser {
    return {
      id: nonSupervisorDoctorUserId,
      name: "Non-Supervisor Doctor",
      email: "nonsup@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asStudent(): SessionUser {
    return {
      id: studentUserId,
      name: "Dashboard Student",
      email: "student@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  it("rejects a non-student from the student dashboard", async () => {
    await expect(getStudentDashboardForUser(asSupervisor())).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("shows real derived data on the student dashboard", async () => {
    const data = await getStudentDashboardForUser(asStudent());

    expect(data.currentPlacement?.id).toBe(createdPlacementIds[0]);
    expect(data.totalHoursLogged).toBeCloseTo(0.5, 5);
    expect(
      data.pendingReflectionActivities.some((a) => a.id === pendingActivityId),
    ).toBe(true);
    expect(
      data.pendingReflectionActivities.some((a) => a.id === completedActivityId),
    ).toBe(false);
    expect(
      data.upcomingShadowing.some(
        (s) => s.appointmentId === upcomingAppointmentId,
      ),
    ).toBe(true);
    expect(
      data.upcomingShadowing.some(
        (s) => s.appointmentId === completedAppointmentId,
      ),
    ).toBe(false);
    expect(
      data.todaysActivities.some((a) => a.id === pendingActivityId),
    ).toBe(true);
    const assessed = data.competencyProgress.find(
      (p) => p.competency.id === competencyId,
    );
    expect(assessed?.currentLevel).toBe(4);
  });

  it("extends the supervising doctor's dashboard with their students and activities awaiting feedback", async () => {
    const data = await getDoctorDashboardForUser(asSupervisor());

    expect(
      data.supervisedStudents.some((p) => p.student.id === studentProfileId),
    ).toBe(true);
    expect(
      data.activitiesAwaitingFeedback.some((a) => a.id === completedActivityId),
    ).toBe(true);
    expect(
      data.activitiesAwaitingFeedback.some((a) => a.id === pendingActivityId),
    ).toBe(false);
  });

  it("leaves supervisedStudents and activitiesAwaitingFeedback empty for a non-supervisor doctor", async () => {
    const data = await getDoctorDashboardForUser(asNonSupervisorDoctor());

    expect(data.supervisedStudents).toHaveLength(0);
    expect(data.activitiesAwaitingFeedback).toHaveLength(0);
  });
});
