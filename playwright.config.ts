import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_NO_WEB_SERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          DATABASE_URL:
            process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/finance",
          RP_ID: process.env.RP_ID ?? "localhost",
          RP_NAME: process.env.RP_NAME ?? "boink!",
          ORIGIN: process.env.ORIGIN ?? BASE_URL,
          NODE_ENV: process.env.NODE_ENV ?? "development",
        },
      },
});
