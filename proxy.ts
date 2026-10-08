import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (and runs it on the
// Node.js runtime, not Edge). This is a coarse, cheap gate -- "is there a
// valid session token at all" -- that runs before any rendering/caching
// machinery, which sidesteps a Cache Components dev-mode bug where a
// redirect() thrown deep in a Suspense-wrapped layout wasn't reaching the
// client. The authoritative, DB-fresh isActive/role checks still happen
// in lib/permissions.ts (requireUser/requireRole), called from every
// layout, page, and server action -- this proxy doesn't replace that.
const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

export async function proxy(request: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
