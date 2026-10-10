"use server";

import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireRole,
  AuthorizationError,
  type SessionUser,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";

const userListSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  roles: { select: { role: { select: { name: true } } } },
} as const;

// Business logic takes the resolved user as a parameter rather than
// fetching the session itself -- that's what makes it directly testable
// (see tests/integration/users.test.ts) without needing a live HTTP
// request to read cookies from.

export async function listUsersForUser(user: SessionUser) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: userListSelect,
  });
}

export async function deactivateUserForUser(
  user: SessionUser,
  targetUserId: string,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");

  if (user.id === targetUserId) {
    throw new AuthorizationError("You cannot deactivate your own account.");
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: false },
  });

  await audit({
    actorId: user.id,
    action: "DEACTIVATED_USER",
    entityType: "User",
    entityId: targetUserId,
  });

  return updated;
}

/**
 * Closes the "password reset" gap from the original brief without a
 * new external dependency -- no email provider exists anywhere in
 * this project (same reason notifications and Document uploads
 * stayed deferred), so there's no secure self-service path. The admin
 * sets a new temporary password and communicates it out-of-band;
 * consistent with staff/student accounts already being
 * admin-provisioned rather than self-service.
 *
 * The plaintext is returned once, to the caller only, and never
 * logged anywhere -- not in the audit entry, not in application logs.
 */
export async function resetPasswordForUser(
  user: SessionUser,
  targetUserId: string,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");

  if (user.id === targetUserId) {
    throw new AuthorizationError(
      "You cannot reset your own password this way.",
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash },
  });

  await audit({
    actorId: user.id,
    action: "RESET_PASSWORD",
    entityType: "User",
    entityId: targetUserId,
  });

  return { temporaryPassword };
}

export async function getCurrentUserForUser(user: SessionUser) {
  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: userListSelect,
  });
}

// Thin wrappers -- these are the actual "use server" entry points called
// from the UI. Each resolves the session, then delegates.

export async function listUsers() {
  const user = await requireUser();
  return listUsersForUser(user);
}

export async function deactivateUser(targetUserId: string) {
  const user = await requireUser();
  return deactivateUserForUser(user, targetUserId);
}

export async function resetPassword(targetUserId: string) {
  const user = await requireUser();
  return resetPasswordForUser(user, targetUserId);
}

export async function getCurrentUser() {
  const user = await requireUser();
  return getCurrentUserForUser(user);
}
