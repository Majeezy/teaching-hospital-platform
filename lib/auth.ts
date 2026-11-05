import type { AuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  checkIpLimit,
  getLoginEmailLimiter,
  getLoginIpLimiter,
  parseClientIp,
} from "@/lib/rate-limit";

// A fixed, precomputed bcrypt hash with no corresponding real password --
// compared against when the email doesn't match a user at all, so a
// nonexistent-email response takes the same ~100ms as a wrong-password
// one. Without this, skipping bcrypt entirely on "no such user" makes the
// two cases distinguishable by response time alone, even though both
// return the same generic `null`.
const TIMING_SAFE_DUMMY_HASH =
  "$2b$12$1WpNFgmyxS.OGV/9jT.seO7ED9KpMLljOHiB.9NQlYS.gZ6PjFXHi";

export const authOptions: AuthOptions = {
  session: {
    // next-auth v4's Credentials provider always issues a JWT-backed
    // session, regardless of this setting -- database sessions only ever
    // apply to OAuth-style providers going through the adapter. Set
    // explicitly so that's a documented decision, not a silent default.
    // Revocation is handled below via a fresh DB check on every request
    // instead of a deletable session row.
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = parseClientIp(req?.headers?.["x-forwarded-for"]);
        const [ipOk, { success: emailOk }] = await Promise.all([
          checkIpLimit(getLoginIpLimiter(), ip),
          getLoginEmailLimiter().limit(credentials.email),
        ]);
        if (!ipOk || !emailOk) {
          // Thrown (not returned) so the callback route redirects with
          // `error=RateLimited` instead of the generic `CredentialsSignin`
          // every other failure produces here -- the login page uses that
          // to show a throttle-specific message. Distinguishing "rate
          // limited" from "wrong password" doesn't leak account existence:
          // both buckets are keyed the same way whether or not the email
          // belongs to a real account.
          throw new Error("RateLimited");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { roles: { include: { role: true } } },
        });

        const isValid = await verifyPassword(
          credentials.password,
          user?.passwordHash ?? TIMING_SAFE_DUMMY_HASH,
        );

        if (!user || !user.isActive || !isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
          roles: user.roles.map((userRole) => userRole.role.name),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: `user` is whatever authorize() returned.
        token.id = user.id;
        token.roles = user.roles;
        token.isActive = user.isActive;
        return token;
      }

      // Every later request: re-check the database rather than trusting
      // the token's stale copy. This is how deactivating a user actually
      // takes effect on their very next request, despite using JWTs
      // instead of a revocable database session row.
      const current = await prisma.user.findUnique({
        where: { id: token.id },
        include: { roles: { include: { role: true } } },
      });

      if (!current || !current.isActive) {
        token.isActive = false;
        return token;
      }

      token.isActive = current.isActive;
      token.roles = current.roles.map((userRole) => userRole.role.name);
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.roles = token.roles;
      session.user.isActive = token.isActive;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
