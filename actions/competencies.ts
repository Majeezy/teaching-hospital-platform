"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireRole,
  hasRole,
  hasAnyRole,
  AuthorizationError,
  type SessionUser,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { assertCanManageStudent } from "@/actions/learning-activities";

const recordAssessmentSchema = z.object({
  studentId: z.string().min(1),
  competencyId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  notes: z.string().trim().max(2000).optional(),
});

export type RecordAssessmentInput = z.infer<typeof recordAssessmentSchema>;

const assessmentHistoryInclude = {
  assessedBy: { select: { name: true } },
} as const;

export async function listCompetencies() {
  await requireUser();
  return prisma.competency.findMany({ orderBy: { name: "asc" } });
}

export async function recordAssessmentForUser(
  user: SessionUser,
  input: RecordAssessmentInput,
) {
  const data = recordAssessmentSchema.parse(input);
  await assertCanManageStudent(user, data.studentId);

  const studentCompetency = await prisma.studentCompetency.upsert({
    where: {
      studentId_competencyId: {
        studentId: data.studentId,
        competencyId: data.competencyId,
      },
    },
    update: {},
    create: { studentId: data.studentId, competencyId: data.competencyId },
  });

  const [assessment] = await prisma.$transaction([
    prisma.competencyAssessment.create({
      data: {
        studentCompetencyId: studentCompetency.id,
        assessedById: user.id,
        score: data.score,
        notes: data.notes || null,
      },
    }),
    prisma.studentCompetency.update({
      where: { id: studentCompetency.id },
      data: { currentLevel: data.score, lastAssessedAt: new Date() },
    }),
  ]);

  await audit({
    actorId: user.id,
    action: "RECORDED_COMPETENCY_ASSESSMENT",
    entityType: "CompetencyAssessment",
    entityId: assessment.id,
    metadata: {
      studentId: data.studentId,
      competencyId: data.competencyId,
      score: data.score,
    },
  });

  return assessment;
}

/**
 * Returns every catalog competency for this student, left-joined with
 * their progress -- a competency the student hasn't been assessed on
 * yet still appears, at level 0, rather than being silently absent.
 * Access: the owning student, a doctor who currently supervises them
 * (active placement -- checked read-only here, not via
 * assertCanManageStudent, since viewing doesn't require canSupervise),
 * or an admin (oversight).
 */
export async function getStudentCompetencyProgressForUser(
  user: SessionUser,
  studentId: string,
) {
  const isAdmin = hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"]);

  let isOwningStudent = false;
  if (hasRole(user, "STUDENT")) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
    });
    isOwningStudent = studentProfile?.id === studentId;
  }

  let isSupervisor = false;
  if (hasRole(user, "DOCTOR")) {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: user.id },
    });
    if (doctorProfile) {
      const placement = await prisma.studentPlacement.findFirst({
        where: {
          studentId,
          supervisorId: doctorProfile.id,
          status: "ACTIVE",
        },
      });
      isSupervisor = !!placement;
    }
  }

  if (!isAdmin && !isOwningStudent && !isSupervisor) {
    throw new AuthorizationError(
      "You don't have access to this student's competency record.",
    );
  }

  const [competencies, studentCompetencies] = await Promise.all([
    prisma.competency.findMany({ orderBy: { name: "asc" } }),
    prisma.studentCompetency.findMany({
      where: { studentId },
      include: {
        assessments: {
          orderBy: { assessedAt: "desc" },
          include: assessmentHistoryInclude,
        },
      },
    }),
  ]);

  const byCompetencyId = new Map(
    studentCompetencies.map((sc) => [sc.competencyId, sc]),
  );

  return {
    canRecordAssessment: isSupervisor,
    progress: competencies.map((competency) => {
      const existing = byCompetencyId.get(competency.id);
      return {
        competency,
        currentLevel: existing?.currentLevel ?? 0,
        lastAssessedAt: existing?.lastAssessedAt ?? null,
        assessments: existing?.assessments ?? [],
      };
    }),
  };
}

export async function getMyCompetencyProgressForUser(user: SessionUser) {
  requireRole(user, "STUDENT");
  const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  return getStudentCompetencyProgressForUser(user, studentProfile.id);
}

export async function listAllCompetencyProgressForUser(user: SessionUser) {
  if (!hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"])) {
    throw new AuthorizationError(
      "Only an admin can view competency progress across all students.",
    );
  }

  return prisma.studentCompetency.findMany({
    include: {
      student: { include: { user: { select: { name: true } } } },
      competency: true,
    },
    orderBy: [{ student: { user: { name: "asc" } } }, { competency: { name: "asc" } }],
  });
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function recordAssessment(input: RecordAssessmentInput) {
  const user = await requireUser();
  return recordAssessmentForUser(user, input);
}

export async function getStudentCompetencyProgress(studentId: string) {
  const user = await requireUser();
  return getStudentCompetencyProgressForUser(user, studentId);
}

export async function getMyCompetencyProgress() {
  const user = await requireUser();
  return getMyCompetencyProgressForUser(user);
}

export async function listAllCompetencyProgress() {
  const user = await requireUser();
  return listAllCompetencyProgressForUser(user);
}
