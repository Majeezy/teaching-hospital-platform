"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  hasRole,
  hasAnyRole,
  AuthorizationError,
  type SessionUser,
} from "@/lib/permissions";
import { notify } from "@/lib/notifications";

const sendMessageSchema = z.object({
  recipientId: z.string().min(1, "Select a recipient"),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "Message body is required").max(5000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export type EligibleRecipient = {
  userId: string;
  name: string;
  roles: string[];
};

const STAFF_ROLES = ["DOCTOR", "NURSE", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"] as const;

function dedupe(recipients: EligibleRecipient[]): EligibleRecipient[] {
  const byId = new Map<string, EligibleRecipient>();
  for (const recipient of recipients) byId.set(recipient.userId, recipient);
  return [...byId.values()];
}

/**
 * Messaging is relationship-scoped, not an open directory (confirmed
 * with the user before building this): a patient can only message
 * their own doctor(s) -- anyone they've had an appointment with, past
 * or present; a student can only message their own supervisor(s) --
 * past or present too, not just the currently active one; staff
 * (doctor/nurse/admin) can message each other freely; admin can
 * message anyone. A doctor's own patients and own supervised students
 * appear in *their* list too -- the relationship is symmetric, derived
 * from the same appointment/placement rows in both directions, not a
 * one-way "only the patient can start it" rule.
 */
export async function listEligibleRecipientsForUser(
  user: SessionUser,
): Promise<EligibleRecipient[]> {
  if (hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"])) {
    // Exhaustive by itself -- admin can message literally anyone, so no
    // other branch below could add anything this one doesn't already
    // cover, even for an account that also holds another role.
    const users = await prisma.user.findMany({
      where: { id: { not: user.id }, isActive: true },
      include: { roles: { include: { role: true } } },
      orderBy: { name: "asc" },
    });
    return users.map((u) => ({
      userId: u.id,
      name: u.name,
      roles: u.roles.map((r) => r.role.name),
    }));
  }

  // Every other branch is additive, not exclusive -- an account holding
  // more than one of these roles (e.g. a doctor who is also a patient
  // elsewhere in the hospital) gets the union of what each role is
  // entitled to, not just whichever branch happened to run first.
  const recipients: EligibleRecipient[] = [];

  if (hasRole(user, "PATIENT")) {
    const patientProfile = await prisma.patientProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const appointments = await prisma.appointment.findMany({
      where: { patientId: patientProfile.id },
      distinct: ["doctorId"],
      select: {
        doctor: { select: { userId: true, user: { select: { name: true } } } },
      },
    });
    recipients.push(
      ...appointments.map((a) => ({
        userId: a.doctor.userId,
        name: a.doctor.user.name,
        roles: ["DOCTOR"],
      })),
    );
  }

  if (hasRole(user, "STUDENT")) {
    const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const placements = await prisma.studentPlacement.findMany({
      where: { studentId: studentProfile.id },
      distinct: ["supervisorId"],
      select: {
        supervisor: { select: { userId: true, user: { select: { name: true } } } },
      },
    });
    recipients.push(
      ...placements.map((p) => ({
        userId: p.supervisor.userId,
        name: p.supervisor.user.name,
        roles: ["DOCTOR"],
      })),
    );
  }

  if (hasRole(user, "DOCTOR") || hasRole(user, "NURSE")) {
    const [staff, doctorProfile] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: { not: user.id },
          isActive: true,
          roles: { some: { role: { name: { in: [...STAFF_ROLES] } } } },
        },
        include: { roles: { include: { role: true } } },
        orderBy: { name: "asc" },
      }),
      hasRole(user, "DOCTOR")
        ? prisma.doctorProfile.findUnique({ where: { userId: user.id } })
        : Promise.resolve(null),
    ]);

    recipients.push(
      ...staff.map((u) => ({
        userId: u.id,
        name: u.name,
        roles: u.roles.map((r) => r.role.name),
      })),
    );

    if (doctorProfile) {
      const [ownPatients, ownStudents] = await Promise.all([
        prisma.appointment.findMany({
          where: { doctorId: doctorProfile.id },
          distinct: ["patientId"],
          select: {
            patient: { select: { userId: true, user: { select: { name: true } } } },
          },
        }),
        prisma.studentPlacement.findMany({
          where: { supervisorId: doctorProfile.id },
          distinct: ["studentId"],
          select: {
            student: { select: { userId: true, user: { select: { name: true } } } },
          },
        }),
      ]);
      recipients.push(
        ...ownPatients.map((a) => ({
          userId: a.patient.userId,
          name: a.patient.user.name,
          roles: ["PATIENT"],
        })),
        ...ownStudents.map((p) => ({
          userId: p.student.userId,
          name: p.student.user.name,
          roles: ["STUDENT"],
        })),
      );
    }
  }

  return dedupe(recipients);
}

export async function sendMessageForUser(
  user: SessionUser,
  input: SendMessageInput,
) {
  const data = sendMessageSchema.parse(input);

  // Recomputed server-side, never trust that the client only submitted
  // a recipient it was shown.
  const eligible = await listEligibleRecipientsForUser(user);
  if (!eligible.some((r) => r.userId === data.recipientId)) {
    throw new AuthorizationError(
      "You don't have a relationship with this recipient.",
    );
  }

  const message = await prisma.message.create({
    data: {
      senderId: user.id,
      recipientId: data.recipientId,
      subject: data.subject || null,
      body: data.body,
    },
  });

  await notify({
    userId: data.recipientId,
    type: "MESSAGE_RECEIVED",
    title: `New message from ${user.name}`,
    body: data.subject || data.body.slice(0, 140),
  });

  return message;
}

const messageInclude = {
  sender: { select: { name: true } },
  recipient: { select: { name: true } },
} as const;

export async function listInboxForUser(user: SessionUser) {
  return prisma.message.findMany({
    where: { recipientId: user.id },
    orderBy: { sentAt: "desc" },
    include: messageInclude,
  });
}

export async function listSentForUser(user: SessionUser) {
  return prisma.message.findMany({
    where: { senderId: user.id },
    orderBy: { sentAt: "desc" },
    include: messageInclude,
  });
}

export async function getUnreadMessageCountForUser(user: SessionUser) {
  return prisma.message.count({
    where: { recipientId: user.id, readAt: null },
  });
}

export async function markMessageReadForUser(
  user: SessionUser,
  messageId: string,
) {
  // Same pattern as markNotificationReadForUser: scoped to this user's
  // own id via updateMany, so marking someone else's message read is a
  // silent no-op, not an error that confirms the id exists.
  await prisma.message.updateMany({
    where: { id: messageId, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listEligibleRecipients() {
  const user = await requireUser();
  return listEligibleRecipientsForUser(user);
}

export async function sendMessage(input: SendMessageInput) {
  const user = await requireUser();
  return sendMessageForUser(user, input);
}

export async function listInbox() {
  const user = await requireUser();
  return listInboxForUser(user);
}

export async function listSent() {
  const user = await requireUser();
  return listSentForUser(user);
}

export async function getUnreadMessageCount() {
  const user = await requireUser();
  return getUnreadMessageCountForUser(user);
}

export async function markMessageRead(messageId: string) {
  const user = await requireUser();
  return markMessageReadForUser(user, messageId);
}
