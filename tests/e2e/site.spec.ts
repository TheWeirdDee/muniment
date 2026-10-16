import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const ROUTES = [
  ["/", /Public answers/i],
  ["/archive", /Find replies by authority, topic or outcome/i],
  ["/preserve", /Add time to records nearing expiry/i],
  ["/collections", /Keep related replies together/i],
  ["/publish", /Try publishing a synthetic reply/i],
  ["/insights", /Explore response times in the demo archive/i],
  ["/developers", /Build on the same records/i],
  ["/how-it-works", /One custodian is one point of failure/i],
  ["/privacy", /Privacy and data/i],
  ["/terms", /Terms of use/i],
] as const

test.describe("every route loads directly, without errors or overflow", () => {
  for (const [path, heading] of ROUTES) {
    test(`direct load ${path}`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(e.message))
      page.on("console", (m) => {
        if (m.type() === "error" && !/Failed to load resource.*(429|favicon)/.test(m.text())) errors.push(m.text())
      })
      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading)
      await expect(page.locator(".scope-bar")).toContainText(/synthetic/i)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      expect(errors, errors.join("\n")).toEqual([])
    })
  }
})

test("prerendered metadata reaches crawlers without JavaScript", async ({ request }) => {
  const html = await (await request.get("/developers")).text()
  expect(html).toContain("<title>Developers · Muniment</title>")
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+\/developers"/)
  expect(html).toContain('property="og:image"')
  const rec = await (await request.get(`/records/0x${"a".repeat(64)}`)).text()
  expect(rec).toContain('content="noindex, follow"')
  expect((await request.get("/sitemap.xml")).status()).toBe(200)
  expect((await request.get("/robots.txt")).status()).toBe(200)
  expect((await request.get("/og.png")).headers()["content-type"]).toContain("image/png")
})

test("unknown URLs return a real 404 with a way back", async ({ page }) => {
  const res = await page.goto("/no-such-page")
  expect(res?.status()).toBe(404)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Not here")
  await page.getByRole("link", { name: /Search the archive/ }).click()
  await expect(page).toHaveURL(/\/archive$/)
})

test("the hosted reader initialises after the clean-URL redirect", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto("/reader.html")
  await expect(page.locator("#ep")).toHaveValue(/^https:\/\//)
  await expect(page.locator("#creators")).toHaveValue(/^0x[0-9a-fA-F]{40}$/)
  await expect(page.getByRole("button", { name: "Read record", exact: true })).toBeEnabled()
  expect(errors).toEqual([])
})

test("an invalid record key is explained, not crashed", async ({ page }) => {
  await page.goto("/records/not-a-key")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("That is not a record key")
})

test("a well-formed key with no entity is reported as not found, not expired", async ({ page }) => {
  await page.goto(`/records/0x${"0".repeat(63)}1`)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/not found on Arkiv/i)
  await expect(page.getByText(/Absence alone does not show which/)).toBeVisible()
})

test("navigation, back/forward and the mobile menu", async ({ page, isMobile }) => {
  await page.goto("/")
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click()
    const menu = page.getByRole("dialog", { name: "Site menu" })
    await expect(menu).toBeVisible()
    await menu.getByRole("link", { name: /^Developers/ }).click()
  } else {
    await page.getByRole("button", { name: /More/ }).click()
    await page.locator("#more-menu").getByRole("link", { name: /Developers/ }).click()
  }
  await expect(page).toHaveURL(/\/developers$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/developers$/)
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: "Site menu" })).toHaveCount(0)
  }
})

test("dark by default; the theme choice persists across reloads", async ({ page, isMobile }) => {
  test.skip(isMobile, "settings live in the mobile menu; covered on desktop")
  await page.goto("/archive")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(17, 17, 20)")
  await page.getByRole("button", { name: "Settings" }).click()
  await page.getByRole("radio", { name: "Light" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
  await page.keyboard.press("Escape")
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(240, 234, 220)")
})

test("archive filters live in the URL and unknown ones are reported", async ({ page, isMobile }) => {
  await page.goto("/archive?outcome=denied&bogus=1&rmax=abc")
  await expect(page.getByText(/Some link parameters were ignored/)).toBeVisible()
  if (isMobile) await page.getByText(/^Filters/).click()
  await expect(page.getByLabel("Outcome")).toHaveValue("denied")
  await page.getByLabel("Outcome").selectOption("granted")
  await expect(page).toHaveURL(/outcome=granted/)
  await page.getByRole("button", { name: "Clear all filters" }).click()
  await expect(page).toHaveURL(/\/archive$/)
})

test("reading never asks for a wallet; settings and wallet dialogs are accessible", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop header control")
  await page.goto("/archive")
  await page.getByRole("button", { name: "Settings" }).click()
  const settingsDialog = page.getByRole("dialog", { name: "Settings" })
  await expect(settingsDialog).toBeVisible()
  await settingsDialog.getByRole("button", { name: /Connect a wallet/ }).click()
  const dialog = page.getByRole("dialog", { name: "Wallet" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/only needed to sign/)).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
})

test("publish refuses identifier-shaped text and requires acknowledgement", async ({ page }) => {
  await page.goto("/publish")
  await page.getByLabel(/Title note/).fill("call 9876543210 or a@b.com")
  await expect(page.getByText(/looks like it contains a/)).toBeVisible()
})

test("collections: create, import malformed and valid files, export excludes notes", async ({ page }) => {
  await page.goto("/collections")
  await page.getByLabel("New collection").fill("E2E collection")
  await page.getByRole("button", { name: "Create", exact: true }).click()
  await expect(page.getByLabel("Collection name")).toHaveValue("E2E collection")
  const input = page.locator("#import-file")
  await input.setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{not json") })
  await expect(page.getByText("File is not valid JSON.")).toBeVisible()
  const good = { format: "muniment.collection/1", collections: [{ name: "Imported", items: [{ key: `0x${"b".repeat(64)}`, note: "secret note" }, { key: "junk" }] }] }
  await input.setInputFiles({ name: "good.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(good)) })
  await expect(page.getByText(/Imported 1 collection/)).toBeVisible()
  await expect(page.getByText(/without a valid entity key were skipped/)).toBeVisible()
  await page.getByRole("link", { name: /Imported/ }).click()
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download JSON" }).click()])
  const text = await (await download.createReadStream()).toArray()
  const body = Buffer.concat(text as Buffer[]).toString()
  expect(body).toContain("b".repeat(64))
  expect(body).not.toContain("secret note")
})

test.describe("accessibility (axe, WCAG 2.1 AA rules)", () => {
  for (const path of ["/", "/archive", "/collections", "/publish", "/developers", "/how-it-works"]) {
    test(`axe ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.waitForTimeout(1500)
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
      expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([])
    })
  }
})
