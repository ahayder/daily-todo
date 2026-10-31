import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests for the core flows. They run the real static export
// (`pnpm e2e:build` → out/) in the local dev workspace (?devWorkspace=1):
// no login, data stays in localStorage, nothing talks to PocketBase. The
// build points PocketBase at the local test DB address so a stray request can
// never reach prod. Port 5010 avoids your dev server. (next dev was too flaky
// for this: its compiler crashed mid-run.)
const PORT = 5010;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/static-server.mjs",
    url: `http://localhost:${PORT}/today`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { PORT: String(PORT) },
  },
});
