import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { RoleName } from "@prisma/client";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (and runs it on the
// Node.js runtime, not Edge). This is a coarse, cheap gate that runs
// before any rendering/caching machinery, which sidesteps a Cache
// Components dev-mode bug where a redirect() thrown deep in a
// Suspense-wrapped layout computed correctly (confirmed via its
// NEXT_REDIRECT digest in server logs) but never reached the client --
// serving a broken 200 instead. Found for the "no session" case in
// Phase 1 Stage 1; recurred in Stage 3 for role-mismatch redirects
// (an active-session patient hitting /admin/*, for example), since those
// aren't covered by a plain "is there a token" check. No data leaked
// either time -- confirmed by checking response bodies directly -- but
// the broken page is a real UX bug, not just cosmetic.
//
// The authoritative, DB-fresh isActive/role checks still run in every
// layout, page, and server action via lib/permissions.ts -- this proxy
// doesn't replace that, it just catches the common cases earlier using
// the token's (possibly slightly stale) embedded roles, before they can
// hit the buggy render path.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/patient",
  "/appointments",
  "/placements",
  "/activities",
  "/logbook",
  "/competencies",
];

const ROLE_RESTRICTED_PREFIXES: { prefix: string; roles: RoleName[] }[] = [
  { prefix: "/admin", roles: ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"] },
  { prefix: "/patient", roles: ["PATIENT"] },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const roleRestriction = ROLE_RESTRICTED_PREFIXES.find((restriction) =>
    pathname.startsWith(restriction.prefix),
  );
  if (roleRestriction) {
    const tokenRoles = (token.roles as RoleName[] | undefined) ?? [];
    const hasAccess = roleRestriction.roles.some((role) =>
      tokenRoles.includes(role),
    );
    if (!hasAccess) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/patient/:path*",
    "/appointments/:path*",
    "/placements/:path*",
    "/activities/:path*",
    "/logbook/:path*",
    "/competencies/:path*",
  ],
};
