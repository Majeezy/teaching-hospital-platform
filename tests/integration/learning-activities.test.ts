import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  assignActivityForUser,
  giveFeedbackForUser,
  listActivitiesForUser,
  startActivityForUser,
  submitReflectionForUser,
} from "@/actions/learning-activities";
import { AuthorizationError, type SessionUser } from "@/lib/permissions";

describe("learning activities authorization and workflow (real database)", () => {
  let supervisorUserId: string;
  let supervisorProfileId: string;
  let otherDoctorUserId: string;
  let studentPlacedUserId: string;
  let studentPlacedProfileId: string;
  let studentUnplacedUserId: string;
  let studentUnplacedProfileId: string;
  const createdPlacementIds: string[] = [];
  const createdActivityIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const [passwordHash, department, studentRole] = await Promise.all([
      hashPassword("test-password-123"),
      prisma.department.findFirstOrThrow(),
      prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } }),
    ]);
    const stamp = Date.now();
    const departmentId = department.id;

    const [supervisor, otherDoctor, studentPlaced, studentUnplaced] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Activity Supervisor",
            email: `test-activity-supervisor-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-ACT-SUP-${stamp}`,
                canSupervise: true,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Other Doctor",
            email: `test-activity-other-${stamp}@example.com`,
            passwordHash,
            doctorProfile: {
              create: {
                departmentId,
                specialization: "General",
                licenseNumber: `LIC-ACT-OTH-${stamp}`,
                canSupervise: true,
              },
            },
          },
          include: { doctorProfile: true },
        }),
        prisma.user.create({
          data: {
            name: "Student Placed",
            email: `test-activity-student-placed-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-ACT-P-${stamp}`,
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
            name: "Student Unplaced",
            email: `test-activity-student-unplaced-${stamp}@example.com`,
            passwordHash,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                studentNumber: `STU-ACT-U-${stamp}`,
                university: "University of Testing",
                yearOfStudy: 1,
                program: "MBChB",
              },
            },
          },
          include: { studentProfile: true },
        }),
      ]);

    supervisorUserId = supervisor.id;
    supervisorProfileId = supervisor.doctorProfile!.id;
    otherDoctorUserId = otherDoctor.id;
    studentPlacedUserId = studentPlaced.id;
    studentPlacedProfileId = studentPlaced.studentProfile!.id;
    studentUnplacedUserId = studentUnplaced.id;
    studentUnplacedProfileId = studentUnplaced.studentProfile!.id;

    allUserIds.push(
      supervisorUserId,
      otherDoctorUserId,
      studentPlacedUserId,
      studentUnplacedUserId,
    );

    const placement = await prisma.studentPlacement.create({
      data: {
        studentId: studentPlacedProfileId,
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
    await prisma.feedback.deleteMany({
      where: { activity: { id: { in: createdActivityIds } } },
    });
    await prisma.studentReflection.deleteMany({
      where: { learningActivityId: { in: createdActivityIds } },
    });
    await prisma.learningActivity.deleteMany({
      where: { id: { in: createdActivityIds } },
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
      name: "Activity Supervisor",
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

  function asStudentPlaced(): SessionUser {
    return {
      id: studentPlacedUserId,
      name: "Student Placed",
      email: "student-placed@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  function asStudentUnplaced(): SessionUser {
    return {
      id: studentUnplacedUserId,
      name: "Student Unplaced",
      email: "student-unplaced@test",
      roles: ["STUDENT"],
      isActive: true,
    };
  }

  it("rejects a doctor with no active placement for this student", async () => {
    await expect(
      assignActivityForUser(asOtherDoctor(), {
        studentId: studentPlacedProfileId,
        title: "Should fail",
        description: "No placement under this doctor",
      }),
    ).rejects.toThrow("does not have an active placement");
  });

  it("rejects assigning to a student with no placement at all", async () => {
    await expect(
      assignActivityForUser(asSupervisor(), {
        studentId: studentUnplacedProfileId,
        title: "Should fail",
        description: "Never placed",
      }),
    ).rejects.toThrow();
  });

  let activityId: string;

  it("lets the supervisor assign an activity to their placed student", async () => {
    const activity = await assignActivityForUser(asSupervisor(), {
      studentId: studentPlacedProfileId,
      title: "Observe a consultation",
      description: "Write up what you observed.",
    });
    createdActivityIds.push(activity.id);
    activityId = activity.id;
    expect(activity.status).toBe("ASSIGNED");

    const auditEntry = await prisma.auditLog.findFirst({
      where: { actorId: supervisorUserId, action: "ASSIGNED_LEARNING_ACTIVITY" },
    });
    expect(auditEntry).not.toBeNull();
  });

  it("rejects a different student starting someone else's activity", async () => {
    await expect(
      startActivityForUser(asStudentUnplaced(), activityId),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects the student submitting a reflection before the activity is accessible to them (wrong doctor can't touch it either)", async () => {
    await expect(
      submitReflectionForUser(asStudentUnplaced(), {
        learningActivityId: activityId,
        content: "Not my activity",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects a non-assigning doctor giving feedback", async () => {
    await expect(
      giveFeedbackForUser(asOtherDoctor(), {
        learningActivityId: activityId,
        strengths: "Should not be allowed",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects giving feedback before a reflection has been submitted", async () => {
    await expect(
      giveFeedbackForUser(asSupervisor(), {
        learningActivityId: activityId,
        strengths: "Too early",
      }),
    ).rejects.toThrow("hasn't submitted a reflection");
  });

  it("lets the owning student start the activity", async () => {
    const updated = await startActivityForUser(asStudentPlaced(), activityId);
    expect(updated.status).toBe("IN_PROGRESS");
  });

  it("rejects starting an activity that's already in progress", async () => {
    await expect(
      startActivityForUser(asStudentPlaced(), activityId),
    ).rejects.toThrow("already IN_PROGRESS");
  });

  it("lets the owning student submit a reflection, completing the activity", async () => {
    const reflection = await submitReflectionForUser(asStudentPlaced(), {
      learningActivityId: activityId,
      content: "I observed a routine consultation and took notes on bedside manner.",
    });
    expect(reflection.studentId).toBe(studentPlacedProfileId);

    const activity = await prisma.learningActivity.findUniqueOrThrow({
      where: { id: activityId },
    });
    expect(activity.status).toBe("COMPLETED");
    expect(activity.completedAt).not.toBeNull();
  });

  it("rejects a second reflection submission on a completed activity", async () => {
    await expect(
      submitReflectionForUser(asStudentPlaced(), {
        learningActivityId: activityId,
        content: "Trying again",
      }),
    ).rejects.toThrow("already COMPLETED");
  });

  it("lets the assigning supervisor give feedback, moving the activity to reviewed", async () => {
    const feedback = await giveFeedbackForUser(asSupervisor(), {
      learningActivityId: activityId,
      rating: 4,
      strengths: "Good attentiveness",
      areasForImprovement: "Ask more follow-up questions",
    });
    expect(feedback.givenToId).toBe(studentPlacedUserId);
    expect(feedback.givenById).toBe(supervisorUserId);

    const activity = await prisma.learningActivity.findUniqueOrThrow({
      where: { id: activityId },
    });
    expect(activity.status).toBe("REVIEWED");

    const auditEntry = await prisma.auditLog.findFirst({
      where: { actorId: supervisorUserId, action: "GAVE_FEEDBACK" },
    });
    expect(auditEntry).not.toBeNull();
  });

  it("rejects giving feedback a second time on an already-reviewed activity", async () => {
    await expect(
      giveFeedbackForUser(asSupervisor(), {
        learningActivityId: activityId,
        strengths: "Again",
      }),
    ).rejects.toThrow("already been reviewed");
  });

  it("scopes the activity list correctly per role", async () => {
    const [supervisorView, studentView, otherDoctorView, unplacedStudentView] =
      await Promise.all([
        listActivitiesForUser(asSupervisor()),
        listActivitiesForUser(asStudentPlaced()),
        listActivitiesForUser(asOtherDoctor()),
        listActivitiesForUser(asStudentUnplaced()),
      ]);

    expect(supervisorView.some((a) => a.id === activityId)).toBe(true);
    expect(studentView.some((a) => a.id === activityId)).toBe(true);
    expect(otherDoctorView.some((a) => a.id === activityId)).toBe(false);
    expect(unplacedStudentView.some((a) => a.id === activityId)).toBe(false);
  });
});
