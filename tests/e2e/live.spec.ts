/**
 * Live-data browser tests. These read the real seeded corpus on Tiramisu; the wallet test signs a
 * real renewal transaction with the RENEWER key through the injected test wallet (tests/e2e/wallet.ts).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { expect, test } from "@playwright/test"
import { injectTestWallet } from "./wallet"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..")
const manifest = JSON.parse(readFileSync(join(ROOT, "evidence", "manifest.json"), "utf8")) as { entries: { id: string; kind: string; key: string }[] }
const replyKey = (id: string) => manifest.entries.find((e) => e.id === id && e.kind === "reply")!.key
const DASHBOARD = process.env.DASHBOARD_URL || "https://muniment-insights.vercel.app"

test.describe.configure({ mode: "serial" })

test("landing shows a real record, not a placeholder", async ({ page }) => {
  await page.goto("/")
  const card = page.locator(".stage .record-card")
  await expect(card).toContainText(/Live from Arkiv/, { timeout: 45_000 })
  await expect(card).toContainText(/Claimed authority/)
  await expect(card).toContainText(/Stored until about/)
  await expect(card).not.toContainText("No demo records")
})

test("archive lists the seeded corpus and filters with a real range query", async ({ page }) => {
  await page.goto("/archive?outcome=denied")
  await expect(page.locator(".reply-row").first()).toBeVisible({ timeout: 45_000 })
  await expect(page.locator(".reply-row")).toHaveCount(7)
  await page.goto("/archive?rmin=31")
  await expect(page.locator(".reply-row").first()).toBeVisible({ timeout: 45_000 })
  for (const t of await page.locator(".reply-row-meta").allInnerTexts()) {
    const m = /Replied in (\d+) days/.exec(t)
    expect(m, t).not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(31)
  }
})

test("a sealed record shows provenance, review status and sealing", async ({ page }) => {
  await page.goto(`/records/${replyKey("r01")}`)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/synthetic/i, { timeout: 45_000 })
  await expect(page.getByText(/Claimed issuing authority/)).toBeVisible()
  await expect(page.getByText(/Sealed: ownership was sent to 0x…dEaD/)).toBeVisible()
  await expect(page.getByText(/Source compared/).first()).toBeVisible({ timeout: 45_000 })
})

test("the disputed and corrected examples render their states", async ({ page }) => {
  await page.goto(`/records/${replyKey("r11")}`)
  await expect(page.getByText(/A reviewer you trust disputes this record/)).toBeVisible({ timeout: 45_000 })
  await page.goto(`/records/${replyKey("r17")}`)
  await expect(page.getByText(/The publisher has issued a correction/)).toBeVisible({ timeout: 45_000 })
  await page.goto(`/records/${replyKey("r41")}`)
  await expect(page.getByText(/This record is a correction/)).toBeVisible({ timeout: 45_000 })
})

test("an unsealed record says the publisher can still delete it", async ({ page }) => {
  await page.goto(`/records/${replyKey("r04")}`)
  await expect(page.getByText(/Publisher-held: the owner wallet can still delete/)).toBeVisible({ timeout: 45_000 })
})

test("standalone reader works from disk with the main site blocked", async ({ page, baseURL }) => {
  const host = new URL(baseURL!).host
  const blocked: string[] = []
  await page.route(`**://${host}/**`, (route) => {
    blocked.push(route.request().url())
    return route.abort("blockedbyclient")
  })
  await page.goto(pathToFileURL(join(ROOT, "reader", "reader.html")).href)
  await expect(page.locator("#net")).toContainText(/Connected: Arkiv Tiramisu/, { timeout: 45_000 })
  await page.locator("#key").fill(replyKey("r01"))
  await page.getByRole("button", { name: "Read record" }).click()
  await expect(page.locator("#detail")).toContainText(/Synthetic test record/, { timeout: 45_000 })
  await expect(page.locator("#detail")).toContainText(/0x817574740F413816636FAE23064607084e2C0604/i)
  // The reader never contacted the main site.
  expect(blocked).toEqual([])
})

test("the separately hosted dashboard reads the same corpus", async ({ page }) => {
  await page.goto(DASHBOARD)
  await expect(page.locator("#coverage")).toContainText(/41 live synthetic replies/, { timeout: 60_000 })
  await expect(page.locator(".heat")).toBeVisible()
  await expect(page.locator("#table tbody tr")).toHaveCount(5)
})

test("a rejected wallet signature sends nothing and says so", async ({ page }) => {
  test.skip(!process.env.RENEWER_KEY, "needs RENEWER_KEY")
  const wallet = await injectTestWallet(page, { key: process.env.RENEWER_KEY as `0x${string}`, reject: true })
  await page.goto(`/records/${replyKey("r03")}`)
  await page.getByRole("button", { name: "Renew storage" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText(/Estimated cost/)).toBeVisible({ timeout: 60_000 })
  await dialog.getByRole("button", { name: /Connect a wallet/ }).click()
  await dialog.getByRole("button", { name: /^Sign / }).click()
  await expect(dialog.getByText(/You declined the request in your wallet. Nothing was sent./)).toBeVisible({ timeout: 30_000 })
  // A parent refresh must not erase the result or silently reset the transaction controls.
  await page.waitForTimeout(2000)
  await expect(dialog.getByText(/You declined the request in your wallet. Nothing was sent./)).toBeVisible()
  expect(wallet.sent).toEqual([])
})

test("a wallet on another network must switch to Tiramisu before signing", async ({ page }) => {
  test.skip(!process.env.RENEWER_KEY, "needs RENEWER_KEY")
  const wallet = await injectTestWallet(page, { key: process.env.RENEWER_KEY as `0x${string}`, chainIdHex: "0x1", reject: true })
  await page.goto(`/records/${replyKey("r03")}`)
  await page.getByRole("button", { name: "Renew storage" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: /Connect a wallet/ }).click()
  await expect(dialog.getByRole("button", { name: "Switch to Tiramisu" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: /^Sign / })).toHaveCount(0)
  await dialog.getByRole("button", { name: "Switch to Tiramisu" }).click()
  await expect(dialog.getByRole("button", { name: /^Sign / })).toBeVisible()
  expect(wallet.sent).toEqual([])
})

test("a quote older than five minutes stops before asking for a signature", async ({ page }) => {
  test.skip(!process.env.RENEWER_KEY, "needs RENEWER_KEY")
  const wallet = await injectTestWallet(page, { key: process.env.RENEWER_KEY as `0x${string}`, reject: true })
  await page.goto(`/records/${replyKey("r03")}`)
  await page.getByRole("button", { name: "Renew storage" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: /Connect a wallet/ }).click()
  const sign = dialog.getByRole("button", { name: /^Sign / })
  await expect(sign).toBeEnabled({ timeout: 60_000 })
  // Advance wall time only; keep real network responses and transaction state intact.
  await page.clock.setSystemTime(Date.now() + 6 * 60_000)
  await sign.click()
  await expect(dialog.getByText(/Transaction 1: Quote out of date/)).toBeVisible({ timeout: 30_000 })
  expect(wallet.sent).toEqual([])
})

test("a different wallet renews a record through the UI and the new expiry is read back", async ({ page }) => {
  test.skip(!process.env.RENEWER_KEY || !process.env.E2E_SIGN, "set E2E_SIGN=1 and RENEWER_KEY to sign a real renewal")
  const w = await injectTestWallet(page, { key: process.env.RENEWER_KEY as `0x${string}` })
  await page.goto(`/records/${replyKey("r03")}`)
  await page.getByRole("button", { name: "Renew storage" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText(/Estimated cost/)).toBeVisible({ timeout: 60_000 })
  await dialog.getByRole("button", { name: /Connect a wallet/ }).click()
  await dialog.getByRole("button", { name: /^Sign / }).click()
  await expect(dialog.getByText(/Verified renewal/)).toBeVisible({ timeout: 180_000 })
  expect(w.sent.length).toBe(1)
  console.log(`UI renewal tx: ${w.sent[0]}`)
})
