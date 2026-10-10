import { defineConfig, devices } from "@playwright/test";

// Chromium only -- this suite exists to catch real integration breaks in
// critical journeys (login, booking, shadowing, admin provisioning), not
// to do cross-browser compatibility testing.
//
// Runs against a production build (`next build` + `next start`), not
// `next dev` -- found the hard way while writing these tests. The
// appointment detail page's Suspense-wrapped dynamic content streams in
// noticeably slower under Turbopack's dev-mode, on-demand compilation
// than it does once built; combined with React's transition semantics
// keeping the pre-mutation UI on screen (no loading flash) until the
// refreshed render is actually ready, a just-saved record could take
// ~9 real seconds to appear under `next dev`, long enough to make an
// otherwise-correct assertion look like a stale-data bug. The
// underlying data was never stale (confirmed by polling the database
// directly while polling the DOM) -- it was purely dev-mode render
// latency. The same flow is fast and reliable against a built app,
// which is also what real users actually experience in production.
export default defineConfig({
  testDir: "./tests/e2e",
  // Generous, same reasoning as vitest.config.mts: real Neon network
  // latency, compounded across a page that makes several DB round
  // trips, can comfortably eat 10-20+ seconds in a way that isn't a
  // sign anything is actually wrong -- confirmed directly while
  // building this suite by polling the database alongside the DOM: the
  // data was correct within ~1s every time, the rendered page just
  // took longer to catch up on a loaded run.
  timeout: 90000,
  expect: { timeout: 30000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
