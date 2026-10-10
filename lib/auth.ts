import type { AuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

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
