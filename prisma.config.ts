import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Plain dotenv only auto-loads a file literally named ".env" -- ".env.local"
// is a Next.js-specific convention, so it has to be pointed at explicitly here.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrate, studio, introspection) needs a direct, unpooled
    // connection -- Neon's pooled connection can't reliably run migrations.
    url: process.env.DIRECT_URL,
  },
});
