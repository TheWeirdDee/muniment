import { defineConfig } from "@playwright/test"

/** Offline fixtures only: no wallets with keys, public RPC or live writes. */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "audit-regressions.spec.ts",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  workers: 2,
  reporter: [["list"], ["json", { outputFile: ".release/audit-regressions.json" }]],
  use: { baseURL: "http://127.0.0.1:4319", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [320, 390, 768, 1024, 1440].map(width => ({ name: `width-${width}`, use: { viewport: { width, height: 900 } } })),
  webServer: [
    { command: "npm run dev -w muniment-web -- --host 127.0.0.1 --port 4319", url: "http://127.0.0.1:4319", reuseExistingServer: !process.env.CI },
    { command: "npm run dev -w muniment-insights -- --host 127.0.0.1 --port 4320", url: "http://127.0.0.1:4320", reuseExistingServer: !process.env.CI },
  ],
})
