import { cache } from "react";
import { connection } from "next/server";
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
 * React's cache() memoizes this per request -- the dashboard layout and
 * every page/action it renders each call this independently, and without
 * memoization that's a redundant session lookup (and DB round trip, since
 * the jwt callback re-checks isActive) on every single one.
 *
 * `connection()` is called first because next-auth v4's getServerSession
 * internally calls Node's crypto.randomBytes(), which Cache Components
 * flags as non-deterministic during prerendering. connection() marks this
 * whole call as request-time-only so Next doesn't try to prerender it --
 * callers still need to wrap in <Suspense> for the route to keep a static
 * shell around it.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  await connection();
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isActive) return null;
  return session.user;
});

/**
 * Resolves the current session and confirms the user is actually allowed to
 * be acting at all. This is the "is this user even active" check deferred
 * from Stage 3 -- every server action should start by calling this.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthorizationError("You must be signed in to do that.");
  }
  return user;
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
