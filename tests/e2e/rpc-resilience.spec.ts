import { expect, test } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

for (const exposed of [true, false]) {
test(`homepage stays useful across reloads and tabs with ${exposed ? "visible" : "hidden"} retry headers`, async ({ page, context }, testInfo) => {
  let requests = 0
  await context.route("**/*", async route => {
    if (route.request().method() === "POST") {
      requests++
      await route.fulfill({ status: 429, headers: { "access-control-allow-origin": "*", ...(exposed ? { "access-control-expose-headers": "retry-after" } : {}), "retry-after": "991", "content-type": "application/json" }, body: JSON.stringify({ error: "Controlled rate-limit fixture" }) })
    } else await route.continue()
  })
  await page.goto("/")
  await expect(page.getByText("What you can do with Muniment", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "A public answer should outlast a portal." })).toBeVisible()
  await expect(page.getByRole("heading", { name: "For people who need to cite the answer later." })).toBeVisible()
  await expect(page.getByRole("button", { name: "Load live renewal candidates" })).toBeVisible()
  expect(requests).toBeLessThanOrEqual(2)
  const initial = requests
  await page.getByText("Live data is temporarily unavailable", { exact: true }).click()
  await expect(page.getByText(/endpoint is rate limiting/)).toBeVisible()
  await page.reload()
  await expect(page.getByText("What you can do with Muniment", { exact: true })).toBeVisible()
  const other = await context.newPage()
  await other.goto("/")
  await expect(other.getByText("What you can do with Muniment", { exact: true })).toBeVisible()
  expect(requests).toBe(initial)
  await page.getByRole("button", { name: "Load live renewal candidates" }).click()
  await expect(page.getByText(/endpoint is rate limiting/).last()).toBeVisible()
  await expect(page.getByText("No trusted records expire in the next 60 days.", { exact: true })).toHaveCount(0)
  expect(requests).toBe(initial)
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  expect(accessibility.violations.filter(v => v.impact === "serious" || v.impact === "critical")).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `.release/rpc-resilience-${testInfo.project.name}-${exposed}.png`, fullPage: true })
  await other.close()
})
}
