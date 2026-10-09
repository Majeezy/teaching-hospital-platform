import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  getMyCompetencyProgressForUser,
  getStudentCompetencyProgressForUser,
  listAllCompetencyProgressForUser,
  recordAssessmentForUser,
} from "@/actions/competencies";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("competency assessment authorization and progress (real database)", () => {
  let supervisorUserId: string;
  let supervisorProfileId: string;
  let otherDoctorUserId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let adminUserId: string;
  let competencyId: string;
  const createdPlacementIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, studentRole, competency] = await Promise.all([
      hashPassword("test-password-123"),
      prisma.department.findFirstOrThrow(),
      prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } }),
      prisma.competency.findFirstOrThrow(),
    ]);
    const stamp = Date.now();
    const departmentId = department.id;
    competencyId = competency.id;

    const [supervisor, otherDoctor, student, admin] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Competency Supervisor",
          email: `test-competency-supervisor-${stamp}@example.com`,
          passwordHash,
          doctorProfile: {
            create: {
              departmentId,
              specialization: "General",
              licenseNumber: `LIC-COMP-${stamp}`,
              canSupervise: true,
            },
          },
        },
        include: { doctorProfile: true },
      }),
      prisma.user.create({
        data: {
          name: "Other Doctor",
          email: `test-competency-other-${stamp}@example.com`,
          passwordHash,
          doctorProfile: {
            create: {
              departmentId,
              specialization: "General",
              licenseNumber: `LIC-COMP-OTH-${stamp}`,
              canSupervise: true,
            },
          },
        },
      }),
      prisma.user.create({
        data: {
          name: "Competency Student",
          email: `test-competency-student-${stamp}@example.com`,
          passwordHash,
          roles: { create: { roleId: studentRole.id } },
          studentProfile: {
            create: {
              studentNumber: `STU-COMP-${stamp}`,
              university: "University of Testing",
              yearOfStudy: 3,
              program: "MBChB",
            },
          },
        },
        include: { studentProfile: true },
      }),
      prisma.user.create({
        data: {
          name: "Test Admin",
          email: `test-competency-admin-${stamp}@example.com`,
          passwordHash,
        },
      }),
    ]);

    supervisorUserId = supervisor.id;
    supervisorProfileId = supervisor.doctorProfile!.id;
    otherDoctorUserId = otherDoctor.id;
    studentUserId = student.id;
    studentProfileId = student.studentProfile!.id;
    adminUserId = admin.id;

    allUserIds.push(
      supervisorUserId,
      otherDoctorUserId,
      studentUserId,
      adminUserId,
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
  });

  afterAll(async () => {
    await prisma.competencyAssessment.deleteMany({
      where: { studentCompetency: { studentId: studentProfileId } },
    });
    await prisma.studentCompetency.deleteMany({
      where: { studentId: studentProfileId },
    });
    await prisma.studentPlacement.deleteMany({
      where: { id: { in: createdPlacementIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: allUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  });

  function asSupervisor(): SessionUser {
    return {
      id: supervisorUserId,
      name: "Competency Supervisor",
      email: "supervisor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asOtherDoctor(): SessionUser {
    return {
      id: otherDoctorUserId,
      name: "Other Doctor",
      email: "other-doctor@test",
      roles: ["DOCTOR"],
      isActive: true,
    };
  }

  function asStudent(): SessionUser {
    return {
      id: studentUserId,
      name: "Competency Student",
      email: "student@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  function asAdmin(): SessionUser {
    return {
      id: adminUserId,
      name: "Test Admin",
      email: "admin@test",
      roles: ["HOSPITAL_ADMIN"],
      isActive: true,
    };
  }

  it("rejects a doctor with no active placement for this student recording an assessment", async () => {
    await expect(
      recordAssessmentForUser(asOtherDoctor(), {
        studentId: studentProfileId,
        competencyId,
        score: 3,
      }),
    ).rejects.toThrow("does not have an active placement");
  });

  it("shows every catalog competency at level 0 before any assessment", async () => {
    const { progress, canRecordAssessment } =
      await getStudentCompetencyProgressForUser(asSupervisor(), studentProfileId);
    expect(canRecordAssessment).toBe(true);
    const entry = progress.find((p) => p.competency.id === competencyId);
    expect(entry).toBeDefined();
    expect(entry!.currentLevel).toBe(0);
    expect(entry!.assessments).toHaveLength(0);
  });

  it("lets the supervisor record an assessment, setting the current level", async () => {
    const assessment = await recordAssessmentForUser(asSupervisor(), {
      studentId: studentProfileId,
      competencyId,
      score: 3,
      notes: "Good first attempt",
    });
    expect(assessment.score).toBe(3);

    const studentCompetency = await prisma.studentCompetency.findUniqueOrThrow({
      where: { studentId_competencyId: { studentId: studentProfileId, competencyId } },
    });
    expect(studentCompetency.currentLevel).toBe(3);
    expect(studentCompetency.lastAssessedAt).not.toBeNull();

    const auditEntry = await prisma.auditLog.findFirst({
      where: { actorId: supervisorUserId, action: "RECORDED_COMPETENCY_ASSESSMENT" },
    });
    expect(auditEntry).not.toBeNull();
  });

  it("records a second assessment, updating the current level and keeping history", async () => {
    await recordAssessmentForUser(asSupervisor(), {
      studentId: studentProfileId,
      competencyId,
      score: 5,
    });

    const { progress } = await getStudentCompetencyProgressForUser(
      asSupervisor(),
      studentProfileId,
    );
    const entry = progress.find((p) => p.competency.id === competencyId);
    expect(entry!.currentLevel).toBe(5);
    expect(entry!.assessments).toHaveLength(2);
    expect(entry!.assessments[0].score).toBe(5);
    expect(entry!.assessments[1].score).toBe(3);
  });

  it("lets the owning student view their own progress", async () => {
    const { progress, canRecordAssessment } = await getMyCompetencyProgressForUser(
      asStudent(),
    );
    expect(canRecordAssessment).toBe(false);
    expect(progress.some((p) => p.competency.id === competencyId)).toBe(true);
  });

  it("rejects a doctor with no relationship to the student viewing progress", async () => {
    await expect(
      getStudentCompetencyProgressForUser(asOtherDoctor(), studentProfileId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("lets the admin view progress for any student", async () => {
    const { progress } = await getStudentCompetencyProgressForUser(
      asAdmin(),
      studentProfileId,
    );
    expect(progress.some((p) => p.competency.id === competencyId)).toBe(true);
  });

  it("rejects a non-admin listing system-wide progress", async () => {
    await expect(
      listAllCompetencyProgressForUser(asSupervisor()),
    ).rejects.toThrow(AuthorizationError);
  });

  it("lets the admin list system-wide progress", async () => {
    const rows = await listAllCompetencyProgressForUser(asAdmin());
    expect(rows.some((r) => r.studentId === studentProfileId)).toBe(true);
  });
});
