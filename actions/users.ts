"use server";

import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireRole,
  AuthorizationError,
  type SessionUser,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";

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

export async function getCurrentUser() {
  const user = await requireUser();
  return getCurrentUserForUser(user);
}
