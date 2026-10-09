import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Integration tests hash passwords (bcrypt, deliberately slow) and hit
    // a real network database -- the 5s/10s defaults are too tight for
    // that combination, not a sign anything is actually wrong. Fixture
    // setup (beforeAll) times out separately from the tests themselves.
    testTimeout: 15000,
    hookTimeout: 20000,
  },
});
