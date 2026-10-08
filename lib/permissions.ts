import { getServerSession } from "next-auth";
import type { RoleName } from "@prisma/client";
import { authOptions } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roles: RoleName[];
  isActive: boolean;
};

export class AuthorizationError extends Error {
  constructor(message = "You are not authorized to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Resolves the current session and confirms the user is actually allowed to
 * be acting at all. This is the "is this user even active" check deferred
 * from Stage 3 -- every server action should start by calling this.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isActive) {
    throw new AuthorizationError("You must be signed in to do that.");
  }
  return session.user;
}

export function hasRole(user: SessionUser, role: RoleName): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(user: SessionUser, roles: RoleName[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function requireRole(user: SessionUser, ...roles: RoleName[]): void {
  if (!hasAnyRole(user, roles)) {
    throw new AuthorizationError(
      `This action requires one of these roles: ${roles.join(", ")}.`,
    );
  }
}

export function isSelf(user: SessionUser, targetUserId: string): boolean {
  return user.id === targetUserId;
}

/**
 * The most common relationship check in this app: a user can act on their
 * own record unconditionally, or an elevated role can act on anyone's.
 * Phase 1's "patient can view their own appointment, staff can view any
 * assigned to them" checks build on this same shape.
 */
export function requireSelfOrRole(
  user: SessionUser,
  targetUserId: string,
  ...roles: RoleName[]
): void {
  if (isSelf(user, targetUserId) || hasAnyRole(user, roles)) return;
  throw new AuthorizationError(
    "You can only do this for your own account, or need an elevated role.",
  );
}
