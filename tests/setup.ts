import { config } from "dotenv";

// Vitest's setupFiles run before any test file is loaded, so this
// completes before app code (e.g. lib/prisma.ts) reads process.env --
// unlike a plain Node script, where static imports are hoisted ahead of
// any of the importing file's own top-level code.
config({ path: ".env.local" });
