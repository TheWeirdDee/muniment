import { expect, test } from "@playwright/test"
import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { SEAL_ADDRESS, politeHttp } from "muniment-query"
import { Evidence, errorText } from "../../scripts/lib.js"
import { injectTestWallet } from "./wallet"

test("publish a sealed synthetic record from a team test wallet through production", async ({ page, isMobile }) => {
  test.skip(isMobile || !process.env.E2E_PUBLISH || !process.env.STRANGER_KEY, "set E2E_PUBLISH=1 and STRANGER_KEY for one real testnet publication")
  test.setTimeout(180_000)
  const ev = new Evidence("ui-publish")
  const wallet = await injectTestWallet(page, { key: process.env.STRANGER_KEY as `0x${string}` })
  await page.goto("/publish")
  await page.getByLabel(/Title note/).fill("Browser verification")
  await page.getByLabel(/I understand this publishes a synthetic test record publicly/).check()
  await page.getByRole("button", { name: "Connect a wallet to publish" }).click()
  await page.getByRole("button", { name: "Sign and publish" }).click()
  await expect(page.getByRole("link", { name: "Open the record", exact: true })).toBeVisible({ timeout: 120_000 })
  const link = page.getByRole("link", { name: "Open the record", exact: true })
  const path = await link.getAttribute("href")
  const key = path!.split("/").pop() as `0x${string}`
  ev.record({ id: "UI-CONFIRMED", title: "Production synthetic publication confirmed", expected: "one real transaction; record and transaction links remain available even if reads are delayed", observed: JSON.stringify({ key, sent: wallet.sent }), outcome: wallet.sent.length === 1 ? "pass" : "fail", txHashes: wallet.sent, entityKeys: [key] })
  const client = createPublicClient({ chain: tiramisu, transport: politeHttp(tiramisu.rpcUrls.default.http[0], { attempts: 1, maxWaitMs: 1000 }) })
  let entity
  try { entity = await client.getEntity(key) }
  catch (error) {
    ev.record({ id: "UI-READBACK", title: "Independent publication readback", expected: "created entity readable", observed: errorText(error), outcome: "blocked", txHashes: wallet.sent, entityKeys: [key] })
    ev.save()
    test.skip(true, "Transaction confirmed; independent readback unavailable. Inspect saved evidence before rerunning to avoid a duplicate.")
    return
  }
  expect(entity.creator.toLowerCase()).toBe(wallet.address.toLowerCase())
  expect(entity.owner.toLowerCase()).toBe(SEAL_ADDRESS.toLowerCase())
  expect(entity.creationFlags.readonly).toBe(true)
  expect(entity.creationFlags.permissionlessExtension).toBe(true)
  expect(wallet.sent).toHaveLength(1)
  ev.record({ id: "UI-PUBLISH", title: "Production synthetic publication with sealing", expected: "one real transaction, stranger creator, sealed owner, readonly and permissionless extension; UI reads it back", observed: JSON.stringify({ creator: entity.creator, owner: entity.owner, expiresAt: String(entity.expiresAt), flags: entity.creationFlags }), outcome: "pass", txHashes: wallet.sent, entityKeys: [key] })
  ev.save()
  await link.click()
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Browser verification", { timeout: 45_000 })
  await expect(page.getByText("Publisher not trusted by this site", { exact: true })).toBeVisible()
})
