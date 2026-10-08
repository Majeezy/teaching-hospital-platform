import { setDefaultAutoSelectFamily } from "net";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Node races IPv4 and IPv6 connection attempts together by default ("Happy
// Eyeballs" / RFC 8305). On a network with no real IPv6 route, the doomed
// IPv6 attempts can drag down the IPv4 ones too, producing a spurious
// ETIMEDOUT even though the IPv4 address is directly reachable. A single
// backend-to-database connection has no need for that racing behavior, so
// it's disabled outright rather than depending on the network it happens
// to run on.
setDefaultAutoSelectFamily(false);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Standard TCP connection to Neon's pooled endpoint -- works reliably on
// any network/runtime that can open a plain Postgres connection, which is
// true for Vercel's Node.js serverless functions (we're not on Edge).
// Migrations use the separate direct connection in prisma.config.ts instead.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
