import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Integration tests hash passwords (bcrypt, deliberately slow) and hit
    // a real network database -- the 5s default is too tight for that
    // combination, not a sign anything is actually wrong.
    testTimeout: 15000,
  },
});
