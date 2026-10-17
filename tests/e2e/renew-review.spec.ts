import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
const manifest = JSON.parse(readFileSync("evidence/manifest.json", "utf8"))
const reply = manifest.entries.find((e: { id:string }) => e.id === "r02").key

test("renewal quote itemizes every entity and expiry before signing", async ({ page }) => {
  await page.goto(`/records/${reply}`)
  await page.getByRole("button", { name:"Renew storage", exact:true }).click()
  const dialog = page.getByRole("dialog", { name:/Renew storage for this record/ })
  const included = dialog.getByLabel("Included entities", { exact:true })
  await expect(included).toBeVisible({ timeout:60000 })
  const summary = await dialog.locator(".panel").first().innerText()
  const count = Number(/(\d+) entit(?:y|ies) will be extended/.exec(summary)?.[1])
  expect(count).toBeGreaterThan(1)
  await expect(included.locator("li")).toHaveCount(count)
  for (const item of await included.locator("li").all()) {
    await expect(item.locator(".hash")).toHaveText(/^0x[0-9a-fA-F]{64}$/)
    await expect(item).toContainText(/Current expiry: block [\d,]+\. Target expiry: block [\d,]+/)
    await expect(item.getByRole("button", { name:/Copy .* key/ })).toBeVisible()
  }
  await expect(included.getByRole("link", { name:reply, exact:true })).toBeVisible()
  expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true)
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Renew storage",exact:true})).toBeFocused()
})
