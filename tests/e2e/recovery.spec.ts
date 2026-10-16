import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

test("record reads recover after a browser network outage", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "same network lifecycle, tested once to conserve public RPC budget")
  test.setTimeout(180_000)
  const manifest = JSON.parse(readFileSync("evidence/manifest.json", "utf8"))
  const key = manifest.entries.find((e: { id: string; kind: string }) => e.id === "r01" && e.kind === "reply").key
  await page.goto(`/records/${key}`)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/synthetic/i, { timeout: 45_000 })
  await context.setOffline(true)
  await page.waitForTimeout(35_000)
  // Previously loaded content remains readable during an outage.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/synthetic/i)
  const preservation = page.getByRole("complementary", { name: "Preservation" })
  const beforeRecovery = await preservation.innerText()
  await context.setOffline(false)
  await expect.poll(() => preservation.innerText(), { timeout: 90_000 }).not.toBe(beforeRecovery)
  await expect(page.getByText(/Updated after (periodic reconciliation|WebSocket recovery|.*event) at/)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/synthetic/i)
})
