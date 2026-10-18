/** Controlled regression fixtures. Fake RPC and providers never sign or broadcast. */
import { expect, test, type Page } from "@playwright/test"
import { replyEntity, k, PUBLISHER } from "../../packages/muniment-query/test/fixtures"
import { ARKIV_ADDRESS, ENTITY_CREATED_TOPIC } from "muniment-query"
import AxeBuilder from "@axe-core/playwright"
import { readFileSync } from "node:fs"
const endpoint = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
const hash = k(999)
function entity(n: number) {
  const e = replyEntity(n, { payload: { ...JSON.parse(new TextDecoder().decode(replyEntity(n).payload)), title: `Synthetic fixture ${n}` } })
  return { ...e, payload: `0x${Buffer.from(e.payload!).toString("hex")}`, createdAt: "0x64", updatedAt: "0x64", expiresAt: "0x2710",
    attributes: Object.entries(e.attributes!).map(([name, a]) => ({ name, type: a.type, value: typeof a.value === "bigint" ? `0x${a.value.toString(16)}` : a.value })) }
}
function appeal() {
  const e = entity(3)
  return { ...e, payload: `0x${Buffer.from(JSON.stringify({ schema: "muniment.appeal/1", synthetic: true, grounds: "Synthetic regression", decision: null, disclosure: "Synthetic fixture" })).toString("hex")}`,
    attributes: e.attributes.filter(a => !["kind", "outcome"].includes(a.name)).concat([
      { name: "kind", type: "str", value: "appeal" }, { name: "reply", type: "key", value: k(1) },
      { name: "stage", type: "str", value: "first-appeal" }, { name: "outcome", type: "str", value: "pending" },
    ]) }
}
async function fixture(page: Page) {
  await page.route("http://127.0.0.1:4319/audit-reader", route => route.fulfill({ contentType: "text/html", body: readFileSync("reader/reader.html", "utf8") }))
  await page.routeWebSocket(/wss:\/\//, socket => socket.close())
  const queries: string[] = []
  let held: Promise<void> | null = null, release = () => {}
  let heldSeen = () => {}
  let chain = "0x7614d1", receipt: any = null
  await page.route("https://**/*", async route => {
    if (route.request().method() !== "POST") return route.abort()
    const req = route.request().postDataJSON()
    if (held && req.method === "arkiv_query" && req.params[0] === `$key = key(${k(1)})`) { heldSeen(); await held }
    const response = (r: any) => {
      let result: any = "0x1"
      if (r.method === "eth_chainId") result = chain
      if (r.method === "eth_blockNumber") result = "0x200"
      if (r.method === "eth_getBlockByNumber") result = { number: "0x200", timestamp: "0x68e00000", transactions: [], baseFeePerGas: "0x1" }
      if (r.method === "eth_call") result = `0x${"0".repeat(64)}`
      if (r.method === "eth_estimateGas") result = "0x100000"
      if (r.method === "eth_getTransactionReceipt") result = receipt
      if (r.method === "eth_getLogs") result = []
      if (r.method === "arkiv_query") {
        const query = r.params[0]; queries.push(query)
        const matches = [...query.matchAll(/\$key = key\((0x[0-9a-f]{64})\)/g)].map((m: any) => m[1])
        result = { data: matches.length ? [1, 2, 3].filter(n => matches.includes(k(n))).map(n => n === 3 ? appeal() : entity(n)) : query.includes("str('reply')") ? [entity(1), entity(2)] : query.includes("reply = key(") && query.includes(k(1)) ? [appeal()] : [], blockNumber: r.params[1]?.atBlock ?? "0x200" }
      }
      return { jsonrpc: "2.0", id: r.id, result }
    }
    await route.fulfill({ json: Array.isArray(req) ? req.map(response) : response(req) })
  })
  await page.addInitScript(`(() => {
    window.__sends = 0;
    window.__providers = [0,1].map(i => {
      const listeners = {};
      return { listeners, address: ['${PUBLISHER}', '0x1111111111111111111111111111111111111111'][i],
        on(e,fn) { (listeners[e] ||= []).push(fn) }, removeListener(e,fn) { listeners[e] = (listeners[e] || []).filter(f => f !== fn) },
        emit(e,v) { (listeners[e] || []).forEach(fn => fn(v)) },
        async request({method}) {
          if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [this.address];
          if (method === 'eth_chainId') return '0x7614d1';
          if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
          if (method === 'eth_sendTransaction') { window.__sends++; if (window.__simulateBroadcast) return '${hash}'; throw Object.assign(new Error('User rejected the request'), {code:4001}) }
          if (method === 'eth_getTransactionReceipt' && window.__simulateBroadcast) throw Object.assign(new Error('Synthetic confirmation polling failure'), {code:4001});
          if (method === 'eth_getBlockByNumber') return {number:'0x200',timestamp:'0x68e00000',transactions:[],baseFeePerGas:'0x1'};
          return method === 'eth_estimateGas' ? '0x100000' : '0x1';
        }
      };
    });
    window.addEventListener('eip6963:requestProvider', () => window.__providers.forEach((provider,i) => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {detail:{info:{uuid:'fixture-'+i,rdns:'fixture-'+i,name:'Fixture wallet '+i,icon:''},provider}}))));
  })()`)
  return { queries, holdRecord: () => { held = new Promise(resolve => { release = resolve }); return new Promise<void>(resolve => { heldSeen = resolve }) }, releaseRecord: () => { release(); held = null }, wrongChain: () => { chain = "0x1" }, confirm: () => { receipt = { transactionHash: hash, to: ARKIV_ADDRESS, from: PUBLISHER, status: "0x1", blockNumber: "0x200", transactionIndex: "0x0", gasUsed: "0x1", cumulativeGasUsed: "0x1", effectiveGasPrice: "0x1", logs: [{ address: ARKIV_ADDRESS, topics: [ENTITY_CREATED_TOPIC, k(1), `0x${PUBLISHER.slice(2).padStart(64, "0")}`], data: `0x${"0".repeat(128)}`, blockNumber: "0x200", transactionHash: hash, transactionIndex: "0x0", logIndex: "0x0", removed: false }] } } }
}

async function openWallet(page: Page) {
  if (await page.getByRole("button", { name: "Open menu", exact: true }).isVisible()) await page.getByRole("button", { name: "Open menu", exact: true }).click()
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("button", { name: /^(Connect a wallet|Manage wallet)$/ }).click()
}

test("wallet switch and forget detach every old listener", async ({ page }) => {
  await fixture(page); await page.goto("/publish")
  await page.getByRole("button", { name: "Connect a wallet to publish" }).click()
  await openWallet(page)
  await expect(page.getByRole("dialog", { name: "Wallet", exact: true })).toContainText("Fixture wallet 0")
  await page.getByRole("button", { name: "Forget this connection" }).click()
  await expect.poll(() => page.evaluate(() => Object.values((window as any).__providers[0].listeners).flat().length)).toBe(0)
  await page.getByRole("button", { name: "Fixture wallet 1", exact: true }).click()
  await page.evaluate(() => (window as any).__providers[0].emit("accountsChanged", ["0x2222222222222222222222222222222222222222"]))
  await expect(page.getByRole("dialog", { name: "Wallet", exact: true })).toContainText("0x111111")
  await page.getByRole("button", { name: "Forget this connection" }).click()
  await page.evaluate(() => (window as any).__providers[1].emit("chainChanged", "0x1"))
  await expect(page.getByRole("button", { name: "Fixture wallet 0", exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as any).__sends)).toBe(0)
})

test("publication requires an exact quote and invalidates it on edits and account change", async ({ page }) => {
  await fixture(page); await page.goto("/publish")
  await page.getByRole("button", { name: "Connect a wallet to publish" }).click()
  await page.getByLabel("Stated filing date (fictional)", { exact: true }).fill("")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Try publishing a synthetic reply.")
  await expect(page.getByText("Choose a filing date between 1 Jan 2025 and today.", { exact: true })).toBeVisible()
  await page.getByLabel("Stated filing date (fictional)", { exact: true }).fill("2026-06-01")
  await page.getByLabel("I understand this publishes").check()
  await page.getByRole("button", { name: "Review publication fee" }).click()
  await expect(page.getByText("Reviewed publication", { exact: true })).toBeVisible()
  await page.getByLabel("Title note (optional, 60 characters)", { exact: true }).fill("Edited synthetic fixture")
  await expect(page.getByRole("button", { name: "Review publication fee" })).toBeVisible()
  await page.getByRole("button", { name: "Review publication fee" }).click()
  await expect(page.getByRole("button", { name: "Sign and publish" })).toBeVisible()
  await page.evaluate(() => (window as any).__providers[0].emit("accountsChanged", ["0x1111111111111111111111111111111111111111"]))
  await expect(page.getByRole("button", { name: "Review publication fee" })).toBeVisible()
  expect(await page.evaluate(() => (window as any).__sends)).toBe(0)
})

test("submitted publication reload recovers by receipt lookup without a signature", async ({ page }) => {
  const f = await fixture(page)
  await page.addInitScript(({ hash }) => sessionStorage.getItem("muniment.publish.pending") || sessionStorage.setItem("muniment.publish.pending", JSON.stringify({ s: "unknown", tx: hash, msg: "Synthetic polling timeout" })), { hash })
  await page.goto("/publish")
  const recheck = page.getByRole("button", { name: "Recheck submitted transaction (no signature)" })
  await recheck.click()
  await expect(page.getByText("No confirmed receipt is available yet.", { exact: false })).toBeVisible()
  await page.reload(); await expect(recheck).toBeVisible()
  f.confirm(); await recheck.click()
  await expect(page.getByText("Confirmed in a block", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign and publish" })).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__sends)).toBe(0)
})

test("a synthetic broadcast hash followed by polling failure cannot be signed again", async ({ page }) => {
  await fixture(page); await page.goto("/publish")
  await page.getByRole("button", { name: "Connect a wallet to publish" }).click()
  await page.getByLabel("I understand this publishes").check()
  await page.getByRole("button", { name: "Review publication fee" }).click()
  await expect(page.getByRole("button", { name: "Sign and publish" })).toBeVisible()
  await page.evaluate(() => { (window as any).__simulateBroadcast = true })
  await page.getByRole("button", { name: "Sign and publish" }).click()
  await expect(page.getByRole("button", { name: "Recheck submitted transaction (no signature)" })).toBeVisible()
  await expect(page.getByText("Not published", { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__sends)).toBe(1)
  await page.reload()
  await expect(page.getByRole("button", { name: "Recheck submitted transaction (no signature)" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign and publish" })).toHaveCount(0)
})

test("late record A cannot overwrite record B after client navigation", async ({ page }) => {
  const f = await fixture(page)
  const observed = f.holdRecord()
  await page.goto(`/records/${k(1)}`); await observed
  const nav = page.getByRole("banner")
  if (await page.getByRole("button", { name: "Open menu", exact: true }).isVisible()) await page.getByRole("button", { name: "Open menu", exact: true }).click()
  await nav.getByRole("link", { name: "Archive", exact: true }).click()
  await page.getByRole("link", { name: "Synthetic fixture 2", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic fixture 2")
  f.releaseRecord()
  await expect.poll(() => page.getByRole("heading", { level: 1 }).innerText()).toBe("Synthetic fixture 2")
  await page.waitForTimeout(200)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic fixture 2")
})

test("archive and standalone reader include the last millisecond of Filed to", async ({ page }) => {
  const f = await fixture(page)
  const upper = Date.UTC(2026, 9, 19) - 1
  await page.goto("/archive?from=2026-10-18&to=2026-10-18")
  await expect.poll(() => f.queries.some(q => q.includes(`filed_ms <= u64(${upper})`))).toBe(true)
  await page.goto("/audit-reader")
  await page.locator("#from").fill("2026-10-18")
  await page.locator("#to").fill("2026-10-18")
  const before = f.queries.length
  await page.getByRole("button", { name: "Search Arkiv", exact: true }).click()
  await expect.poll(() => f.queries.slice(before).some(q => q.includes(`filed_ms <= u64(${upper})`))).toBe(true)
  await page.locator("#from").fill("2026-10-19")
  await page.getByRole("button", { name: "Search Arkiv", exact: true }).click()
  await expect(page.locator("#status")).toContainText("must not be later")
})

test("reader enforces chain identity after endpoint changes and disables exports", async ({ page }) => {
  const f = await fixture(page); await page.goto("/audit-reader")
  await page.getByRole("button", { name: "Search Arkiv", exact: true }).click()
  await expect(page.locator("#export")).toBeEnabled()
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export").click()])
  const chunks = await (await download.createReadStream()).toArray()
  expect(JSON.parse(Buffer.concat(chunks).toString())).toMatchObject({ endpoint, chainId: 7738577 })
  await page.locator("#ep").fill("https://different.invalid")
  await expect(page.locator("#export")).toBeDisabled()
  f.wrongChain(); const before = f.queries.length
  await page.getByRole("button", { name: "Search Arkiv", exact: true }).click()
  await expect(page.locator("#status")).toContainText("not Tiramisu")
  expect(f.queries).toHaveLength(before)
})

test("collection membership refresh retains the two-record reviewed plan", async ({ page }) => {
  await fixture(page)
  await page.addInitScript(({ keys }) => localStorage.setItem("muniment.collections.v1", JSON.stringify([{ id: "regression", name: "Synthetic audit collection", createdAtMs: 1, items: keys.map(key => ({ key, addedAtMs: 1, observation: null })) }])), { keys: [k(1), k(2)] })
  await page.goto("/collections")
  await page.getByRole("button", { name: "Renew storage for collection", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Renew storage for 2 records", exact: true })
  await expect(dialog.getByLabel("Included entities", { exact: true }).locator("li")).toHaveCount(3)
  await page.evaluate(() => {
    const key = "muniment.collections.v1", all = JSON.parse(localStorage.getItem(key)!)
    all[0].items.pop()
    const newValue = JSON.stringify(all)
    localStorage.setItem(key, newValue)
    dispatchEvent(new StorageEvent("storage", { key, newValue }))
  })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel("Included entities", { exact: true }).locator("li")).toHaveCount(3)
  await expect(dialog).toContainText(k(2))
  expect(await page.evaluate(() => (window as any).__sends)).toBe(0)
})

test("dashboard rejects wrong-chain endpoints and labels local validation correctly", async ({ page }) => {
  const f = await fixture(page); f.wrongChain()
  await page.goto("http://127.0.0.1:4320")
  await expect(page.locator("#coverage")).toContainText("not Tiramisu")
  await expect(page.locator("#tiles")).toBeEmpty()
  expect(f.queries).toHaveLength(0)
  await page.locator("#creators").fill("invalid")
  await page.getByRole("button", { name: "Load from Arkiv" }).click()
  await expect(page.locator("#coverage")).toContainText("Check the settings")
  await expect(page.locator("#coverage")).not.toContainText("..")
})

test("unknown multi-record renewal survives collection refresh and reload without rebroadcast", async ({ page }) => {
  await fixture(page)
  await page.addInitScript(({ keys }) => {
    if (!localStorage.getItem("muniment.collections.v1")) localStorage.setItem("muniment.collections.v1", JSON.stringify([{ id: "pending-regression", name: "Synthetic pending collection", createdAtMs: 1, items: keys.map(key => ({ key, addedAtMs: 1, observation: null })) }]))
  }, { keys: [k(1), k(2)] })
  await page.goto("/collections")
  await page.getByRole("button", { name: "Renew storage for collection", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Renew storage for 2 records", exact: true })
  await expect(dialog.getByLabel("Included entities", { exact: true }).locator("li")).toHaveCount(3)
  await dialog.getByRole("button", { name: "Connect a wallet to sign" }).click()
  const sign = dialog.getByRole("button", { name: "Sign 1 transaction", exact: true })
  await expect(sign).toBeEnabled()
  await page.evaluate(() => { (window as any).__simulateBroadcast = true })
  await sign.click()
  const recheck = dialog.getByRole("button", { name: "Recheck submitted transaction (no signature)" })
  await expect(recheck).toBeVisible()
  await expect(dialog.getByLabel("Included entities", { exact: true }).locator("li")).toHaveCount(3)
  await expect(dialog.getByRole("button", { name: "Continue remaining transactions" })).toBeDisabled()
  expect(await page.evaluate(() => (window as any).__sends)).toBe(1)
  await page.reload()
  await page.getByRole("button", { name: "Renew storage for collection", exact: true }).click()
  await expect(recheck).toBeVisible()
  await recheck.click()
  await expect(dialog).toContainText("No confirmed receipt is available yet.")
  await expect(dialog.getByLabel("Included entities", { exact: true }).locator("li")).toHaveCount(3)
  expect(await page.evaluate(() => (window as any).__sends)).toBe(0)
})

test("fixture routes have no serious accessibility violations or horizontal overflow", async ({ page }) => {
  await fixture(page)
  const pageErrors: string[] = []
  page.on("pageerror", error => pageErrors.push(error.message))
  for (const route of ["/", "/archive", "/publish", "/collections", "/how-it-works", "/developers"]) {
    await page.goto(route)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
    expect(results.violations.filter(v => v.impact === "serious" || v.impact === "critical")).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(pageErrors).toEqual([])
})
