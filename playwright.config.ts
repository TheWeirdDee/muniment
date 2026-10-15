import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests run against BASE_URL (default: the production deployment).
 *   BASE_URL=http://localhost:4319 npx playwright test
 * Wallet tests sign real Tiramisu transactions with the RENEWER/STRANGER keys from .env through an
 * injected EIP-1193 test wallet; they are skipped when those keys are absent.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "evidence/e2e-results.json" }], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.BASE_URL || "https://muniment-archive.vercel.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
})
