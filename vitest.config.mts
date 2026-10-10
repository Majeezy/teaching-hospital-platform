import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // tests/e2e is Playwright's own suite (playwright.config.ts), run via
    // `npm run test:e2e` -- it uses @playwright/test's own test/expect,
    // not Vitest's, so Vitest must not try to collect those files too.
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    // Integration tests hash passwords (bcrypt, deliberately slow) and hit
    // a real network database -- the 5s/10s defaults are too tight for
    // that combination, not a sign anything is actually wrong. Fixture
    // setup (beforeAll) times out separately from the tests themselves.
    testTimeout: 15000,
    hookTimeout: 20000,
  },
});
