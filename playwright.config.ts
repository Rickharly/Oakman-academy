import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm next dev --port ${port}`,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { ...process.env, AI_PROVIDER: "mock", CURRICULUM_PROVIDER: "fixture" },
  },
  projects: [
    { name: "ipad", use: { ...devices["iPad (gen 7)"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
