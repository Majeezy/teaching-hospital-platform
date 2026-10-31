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
import { sendPasswordResetEmail } from "@/lib/email";

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

/**
 * Neither deactivation nor password reset has any concept of an admin
 * hierarchy today (RoleName has two admin tiers, HOSPITAL_ADMIN and
 * SYSTEM_ADMIN, with no ordering enforced anywhere else), so the
 * simplest safe rule is: no admin action through these two functions
 * can target another admin account at all, regardless of tier.
 */
async function assertTargetIsNotAdmin(targetUserId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { roles: { select: { role: { select: { name: true } } } } },
  });
  const isAdmin = target?.roles.some((r) =>
    (["HOSPITAL_ADMIN", "SYSTEM_ADMIN"] as const).includes(
      r.role.name as "HOSPITAL_ADMIN" | "SYSTEM_ADMIN",
    ),
  );
  if (isAdmin) {
    throw new AuthorizationError(
      "You cannot do this to another admin account.",
    );
  }
}

export async function deactivateUserForUser(
  user: SessionUser,
  targetUserId: string,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");

  if (user.id === targetUserId) {
    throw new AuthorizationError("You cannot deactivate your own account.");
  }
  await assertTargetIsNotAdmin(targetUserId);

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
 * Closes the "password reset" gap from the original brief. There's
 * still no self-service path (staff/student accounts are
 * admin-provisioned, not self-service, same as account creation) --
 * the admin triggers the reset, and the user is now notified directly
 * by email (Phase 6 Stage 3) rather than relying on the admin to
 * relay the password out-of-band by hand.
 *
 * The plaintext is still returned once, to the caller only, and never
 * logged anywhere -- not in the audit entry, not in application logs.
 * It stays in the return value (rather than being dropped now that
 * email exists) as the out-of-band fallback for the one case that
 * matters most: the email failing to send.
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
  await assertTargetIsNotAdmin(targetUserId);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const target = await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash },
  });

  await audit({
    actorId: user.id,
    action: "RESET_PASSWORD",
    entityType: "User",
    entityId: targetUserId,
  });

  // Best-effort: the password is already changed and audited above, so a
  // Resend outage shouldn't block the reset itself -- it just falls back
  // to the admin sharing temporaryPassword out-of-band, same as before
  // this stage.
  let emailSent = true;
  try {
    await sendPasswordResetEmail({
      to: target.email,
      name: target.name,
      temporaryPassword,
    });
  } catch (error) {
    emailSent = false;
    console.error("Failed to send password reset email:", error);
  }

  return { temporaryPassword, emailSent };
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
