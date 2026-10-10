"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireRole,
  hasRole,
  hasAnyRole,
  requireFound,
  AuthorizationError,
  type SessionUser,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

const assignActivitySchema = z.object({
  studentId: z.string().min(1, "Select a student"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(2000),
  relatedAppointmentId: z.string().min(1).optional(),
  dueDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
    .optional(),
});

const submitReflectionSchema = z.object({
  learningActivityId: z.string().min(1),
  content: z.string().trim().min(1, "Reflection content is required").max(5000),
});

const giveFeedbackSchema = z.object({
  learningActivityId: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  strengths: z.string().trim().max(2000).optional(),
  areasForImprovement: z.string().trim().max(2000).optional(),
  recommendedActivities: z.string().trim().max(2000).optional(),
});

export type AssignActivityInput = z.infer<typeof assignActivitySchema>;
export type SubmitReflectionInput = z.infer<typeof submitReflectionSchema>;
export type GiveFeedbackInput = z.infer<typeof giveFeedbackSchema>;

const activityInclude = {
  student: { include: { user: { select: { name: true } } } },
  supervisor: { include: { user: { select: { name: true } } } },
  relatedAppointment: {
    select: { scheduledAt: true, reason: true },
  },
  reflection: true,
  feedback: { orderBy: { createdAt: "desc" } },
} as const;

/**
 * Same eligibility rule as shadowing (assertCanManageShadowing in
 * actions/shadowing.ts): a supervising doctor (canSupervise = true) with
 * an active placement for this specific student. Kept separate rather
 * than shared because this one is keyed by studentId, not
 * appointmentId -- an activity doesn't need to be tied to any one
 * appointment at all.
 */
export async function assertCanManageStudent(user: SessionUser, studentId: string) {
  requireRole(user, "DOCTOR");
  const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  if (!doctorProfile.canSupervise) {
    throw new AuthorizationError(
      "You are not marked as able to supervise students.",
    );
  }

  const placement = await prisma.studentPlacement.findFirst({
    where: { studentId, supervisorId: doctorProfile.id, status: "ACTIVE" },
  });
  if (!placement) {
    throw new AuthorizationError(
      "This student does not have an active placement under you.",
    );
  }

  return { doctorProfile };
}

export async function listSupervisedStudentsForUser(user: SessionUser) {
  requireRole(user, "DOCTOR");
  const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  const placements = await prisma.studentPlacement.findMany({
    where: { supervisorId: doctorProfile.id, status: "ACTIVE" },
    include: { student: { include: { user: { select: { name: true } } } } },
  });

  return placements.map((placement) => placement.student);
}

export async function listShadowedAppointmentsForUser(
  user: SessionUser,
  studentId: string,
) {
  // Powers the "related appointment" picker in the assign-activity form:
  // only appointments this specific student actually shadowed under this
  // specific supervisor are valid choices, enforced again server-side in
  // assignActivityForUser -- this is just what's offered in the UI.
  const { doctorProfile } = await assertCanManageStudent(user, studentId);

  const assignments = await prisma.shadowingAssignment.findMany({
    where: {
      studentId,
      appointment: { doctorId: doctorProfile.id },
    },
    include: {
      appointment: { select: { id: true, scheduledAt: true, reason: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return assignments.map((assignment) => assignment.appointment);
}

export async function assignActivityForUser(
  user: SessionUser,
  input: AssignActivityInput,
) {
  const data = assignActivitySchema.parse(input);
  const { doctorProfile } = await assertCanManageStudent(user, data.studentId);

  if (data.relatedAppointmentId) {
    const appointment = requireFound(
      await prisma.appointment.findUnique({
        where: { id: data.relatedAppointmentId },
      }),
    );
    if (appointment.doctorId !== doctorProfile.id) {
      throw new AuthorizationError(
        "You can only tie an activity to your own appointment.",
      );
    }
    const shadowed = await prisma.shadowingAssignment.findUnique({
      where: {
        appointmentId_studentId: {
          appointmentId: data.relatedAppointmentId,
          studentId: data.studentId,
        },
      },
    });
    if (!shadowed) {
      throw new Error(
        "This student did not shadow that appointment, so it can't be the related session.",
      );
    }
  }

  const activity = await prisma.learningActivity.create({
    data: {
      studentId: data.studentId,
      supervisorId: doctorProfile.id,
      title: data.title,
      description: data.description,
      relatedAppointmentId: data.relatedAppointmentId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
    include: { student: { select: { userId: true } } },
  });

  await audit({
    actorId: user.id,
    action: "ASSIGNED_LEARNING_ACTIVITY",
    entityType: "LearningActivity",
    entityId: activity.id,
    metadata: { studentId: data.studentId },
  });

  await notify({
    userId: activity.student.userId,
    type: "ACTIVITY_ASSIGNED",
    title: "New learning activity",
    body: `"${activity.title}" has been assigned to you.`,
  });

  return activity;
}

export async function startActivityForUser(
  user: SessionUser,
  activityId: string,
) {
  requireRole(user, "STUDENT");
  const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  const activity = requireFound(
    await prisma.learningActivity.findUnique({ where: { id: activityId } }),
  );
  if (activity.studentId !== studentProfile.id) {
    throw new AuthorizationError("This isn't your activity.");
  }
  if (activity.status !== "ASSIGNED") {
    throw new Error(`Cannot start an activity that is already ${activity.status}.`);
  }

  const updated = await prisma.learningActivity.update({
    where: { id: activityId },
    data: { status: "IN_PROGRESS" },
  });

  await audit({
    actorId: user.id,
    action: "STARTED_LEARNING_ACTIVITY",
    entityType: "LearningActivity",
    entityId: activityId,
  });

  return updated;
}

export async function submitReflectionForUser(
  user: SessionUser,
  input: SubmitReflectionInput,
) {
  const data = submitReflectionSchema.parse(input);
  requireRole(user, "STUDENT");
  const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  const activity = requireFound(
    await prisma.learningActivity.findUnique({
      where: { id: data.learningActivityId },
      include: { supervisor: { select: { userId: true } } },
    }),
  );
  if (activity.studentId !== studentProfile.id) {
    throw new AuthorizationError("This isn't your activity.");
  }
  if (activity.status !== "ASSIGNED" && activity.status !== "IN_PROGRESS") {
    throw new Error(
      `Cannot submit a reflection for an activity that is already ${activity.status}.`,
    );
  }

  const [reflection] = await prisma.$transaction([
    prisma.studentReflection.create({
      data: {
        learningActivityId: data.learningActivityId,
        studentId: studentProfile.id,
        content: data.content,
      },
    }),
    prisma.learningActivity.update({
      where: { id: data.learningActivityId },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
  ]);

  await audit({
    actorId: user.id,
    action: "SUBMITTED_REFLECTION",
    entityType: "StudentReflection",
    entityId: reflection.id,
    metadata: { learningActivityId: data.learningActivityId },
  });

  await notify({
    userId: activity.supervisor.userId,
    type: "REFLECTION_SUBMITTED",
    title: "Reflection submitted",
    body: `${user.name} submitted a reflection for "${activity.title}".`,
  });

  return reflection;
}

export async function giveFeedbackForUser(
  user: SessionUser,
  input: GiveFeedbackInput,
) {
  const data = giveFeedbackSchema.parse(input);
  requireRole(user, "DOCTOR");
  const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  const activity = requireFound(
    await prisma.learningActivity.findUnique({
      where: { id: data.learningActivityId },
      include: { student: { select: { userId: true } } },
    }),
  );
  if (activity.supervisorId !== doctorProfile.id) {
    throw new AuthorizationError(
      "You can only review activities you assigned.",
    );
  }
  if (activity.status !== "COMPLETED") {
    throw new Error(
      activity.status === "REVIEWED"
        ? "This activity has already been reviewed."
        : "The student hasn't submitted a reflection yet.",
    );
  }

  const [feedback] = await prisma.$transaction([
    prisma.feedback.create({
      data: {
        givenById: user.id,
        givenToId: activity.student.userId,
        relatedActivityId: data.learningActivityId,
        rating: data.rating ?? null,
        strengths: data.strengths || null,
        areasForImprovement: data.areasForImprovement || null,
        recommendedActivities: data.recommendedActivities || null,
      },
    }),
    prisma.learningActivity.update({
      where: { id: data.learningActivityId },
      data: { status: "REVIEWED" },
    }),
  ]);

  await audit({
    actorId: user.id,
    action: "GAVE_FEEDBACK",
    entityType: "Feedback",
    entityId: feedback.id,
    metadata: { learningActivityId: data.learningActivityId },
  });

  await notify({
    userId: activity.student.userId,
    type: "FEEDBACK_GIVEN",
    title: "Feedback received",
    body: `Your supervisor reviewed "${activity.title}".`,
  });

  return feedback;
}

export async function listActivitiesForUser(user: SessionUser) {
  if (hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"])) {
    return prisma.learningActivity.findMany({
      orderBy: { id: "desc" },
      include: activityInclude,
    });
  }

  if (hasRole(user, "DOCTOR")) {
    const doctorProfile = await prisma.doctorProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.learningActivity.findMany({
      where: { supervisorId: doctorProfile.id },
      orderBy: { id: "desc" },
      include: activityInclude,
    });
  }

  if (hasRole(user, "STUDENT")) {
    const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return prisma.learningActivity.findMany({
      where: { studentId: studentProfile.id },
      orderBy: { id: "desc" },
      include: activityInclude,
    });
  }

  throw new AuthorizationError(
    "Your role does not have access to learning activities.",
  );
}

export async function getActivityForUser(
  user: SessionUser,
  activityId: string,
) {
  // The activity fetch and the role-specific profile lookup don't
  // depend on each other -- which profile to fetch is already known
  // from the session's roles, not from anything the activity query
  // returns -- so they run together rather than two sequential Neon
  // round trips. Found live: after a supervisor records feedback,
  // router.refresh() calls this on the way back, and the page sat on
  // "Saving…" for several real seconds even though the mutation (and
  // its toast) had already completed -- the same class of bug fixed
  // for appointments in Phase 4 Stage 3, just never applied here.
  const [activityResult, doctorProfile, studentProfile] = await Promise.all([
    prisma.learningActivity.findUnique({
      where: { id: activityId },
      include: activityInclude,
    }),
    hasRole(user, "DOCTOR")
      ? prisma.doctorProfile.findUnique({ where: { userId: user.id } })
      : Promise.resolve(null),
    hasRole(user, "STUDENT")
      ? prisma.studentProfile.findUnique({ where: { userId: user.id } })
      : Promise.resolve(null),
  ]);

  const activity = requireFound(activityResult);

  const isAdmin = hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"]);
  const isAssigningSupervisor = doctorProfile?.id === activity.supervisorId;
  const isOwningStudent = studentProfile?.id === activity.studentId;

  if (!isAdmin && !isAssigningSupervisor && !isOwningStudent) {
    throw new AuthorizationError("You don't have access to this activity.");
  }

  return {
    activity,
    canStart: isOwningStudent && activity.status === "ASSIGNED",
    canSubmitReflection:
      isOwningStudent &&
      (activity.status === "ASSIGNED" || activity.status === "IN_PROGRESS"),
    canGiveFeedback: isAssigningSupervisor && activity.status === "COMPLETED",
  };
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listSupervisedStudents() {
  const user = await requireUser();
  return listSupervisedStudentsForUser(user);
}

export async function listShadowedAppointments(studentId: string) {
  const user = await requireUser();
  return listShadowedAppointmentsForUser(user, studentId);
}

export async function assignActivity(input: AssignActivityInput) {
  const user = await requireUser();
  return assignActivityForUser(user, input);
}

export async function startActivity(activityId: string) {
  const user = await requireUser();
  return startActivityForUser(user, activityId);
}

export async function submitReflection(input: SubmitReflectionInput) {
  const user = await requireUser();
  return submitReflectionForUser(user, input);
}

export async function giveFeedback(input: GiveFeedbackInput) {
  const user = await requireUser();
  return giveFeedbackForUser(user, input);
}

export async function listActivities() {
  const user = await requireUser();
  return listActivitiesForUser(user);
}

export async function getActivity(activityId: string) {
  const user = await requireUser();
  return getActivityForUser(user, activityId);
}
