/**
 * Records the demo film from the PRODUCTION site with Playwright. Every chain action is real: the
 * renewal is signed by the RENEWER test wallet through the injected EIP-1193 test wallet, and the
 * reader segment blocks the main site's origin. Writes demo/out/raw.webm, demo/out/scenes.json
 * (timings, tx hashes) and demo/out/captions.srt. Narration WAVs come from scripts/demo-narration.ps1.
 *
 *   node --env-file=.env --import tsx scripts/record-demo.ts
 */
import { readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium, type Page } from "@playwright/test"
import { injectTestWallet } from "../tests/e2e/wallet.js"
import { ROOT } from "./lib.js"

const BASE = process.env.BASE_URL || "https://muniment-archive.vercel.app"
const DASH = process.env.DASHBOARD_URL || "https://muniment-insights.vercel.app"
const OUT = join(ROOT, "demo", "out")
const lines = JSON.parse(readFileSync(join(ROOT, "demo", "narration.json"), "utf8")) as string[]
const manifest = JSON.parse(readFileSync(join(ROOT, "evidence", "manifest.json"), "utf8")) as { entries: { id: string; kind: string; key: string }[] }
const key = (id: string) => manifest.entries.find((e) => e.id === id && e.kind === "reply")!.key

/** Duration of a PCM WAV file in ms, read from its header. */
function wavMs(file: string): number {
  const b = readFileSync(file)
  const byteRate = b.readUInt32LE(28)
  let off = 12
  while (off < b.length - 8) {
    const id = b.toString("ascii", off, off + 4)
    const size = b.readUInt32LE(off + 4)
    if (id === "data") return Math.round((size / byteRate) * 1000)
    off += 8 + size
  }
  throw new Error(`no data chunk in ${file}`)
}
const audioMs = lines.map((_, i) => wavMs(join(OUT, `scene${i + 1}.wav`)))

let t0 = Date.now()
const scenes: { n: number; startMs: number; endMs: number; text: string; notes: string[] }[] = []

async function caption(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById("__demo_caption")
    if (!el) {
      el = document.createElement("div")
      el.id = "__demo_caption"
      el.setAttribute("aria-hidden", "true")
      el.style.cssText =
        "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:1040px;width:calc(100% - 80px);z-index:2147483647;background:rgba(17,17,20,.92);color:#f0eadc;font:500 21px/1.4 system-ui,sans-serif;padding:14px 20px;border-left:4px solid #ffd95d;border-radius:4px;pointer-events:none"
      document.body.appendChild(el)
    }
    el.textContent = t
  }, text)
}

async function scene(n: number, page: Page, run: (notes: string[]) => Promise<void>) {
  const startMs = Date.now() - t0
  const notes: string[] = []
  await caption(page, lines[n - 1])
  const work = run(notes)
  await Promise.all([work, page.waitForTimeout(audioMs[n - 1] + 900)])
  await caption(page, lines[n - 1])
  scenes.push({ n, startMs, endMs: Date.now() - t0, text: lines[n - 1], notes })
  console.log(`scene ${n} done at ${((Date.now() - t0) / 1000).toFixed(1)} s ${notes.join(" | ")}`)
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }, colorScheme: "dark" })
  const page = await context.newPage()
  t0 = Date.now() // the video starts with the page
  const wallet = await injectTestWallet(page, { key: process.env.RENEWER_KEY as `0x${string}` })
  page.on("framenavigated", () => {})

  await page.goto(BASE, { waitUntil: "domcontentloaded" })
  await page.locator(".stage .record-card").waitFor({ timeout: 60_000 })
  await page.getByText(/Stored until about/).waitFor({ timeout: 60_000 }).catch(() => {})

  await scene(1, page, async () => {
    await page.waitForTimeout(1500)
    await page.mouse.move(900, 380, { steps: 20 })
  })

  await scene(2, page, async (notes) => {
    await page.goto(`${BASE}/archive?outcome=denied`, { waitUntil: "domcontentloaded" })
    await caption(page, lines[1])
    await page.locator(".reply-row").first().waitFor({ timeout: 60_000 })
    notes.push(`refused replies shown: ${await page.locator(".reply-row").count()}`)
    await page.waitForTimeout(2500)
    await page.goto(`${BASE}/records/${key("r01")}`, { waitUntil: "domcontentloaded" })
    await caption(page, lines[1])
    await page.getByText(/Claimed issuing authority/).waitFor({ timeout: 60_000 })
    await page.locator("#prov-h").scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, 120)
  })

  await scene(3, page, async () => {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByRole("button", { name: /Save to collection|Saved in/ }).first().click()
    await page.getByLabel("New collection").fill("Road spending story")
    await page.getByRole("button", { name: "Create and save" }).click()
    await page.waitForTimeout(1200)
    await page.keyboard.press("Escape")
    await page.goto(`${BASE}/collections`, { waitUntil: "domcontentloaded" })
    await caption(page, lines[2])
  })

  await scene(4, page, async (notes) => {
    await page.goto(`${BASE}/records/${key("r03")}`, { waitUntil: "domcontentloaded" })
    await caption(page, lines[3])
    await page.getByRole("button", { name: "Renew storage" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByText(/Estimated cost/).waitFor({ timeout: 90_000 })
    await page.waitForTimeout(1500)
    await dialog.getByRole("button", { name: /Connect a wallet/ }).click()
    await dialog.getByRole("button", { name: /^Sign / }).click()
    await dialog.getByText(/Verified renewal|could not be verified|Failed/).waitFor({ timeout: 180_000 })
    notes.push(`renewal tx: ${wallet.sent.join(",")}`)
    notes.push(`final state: ${(await dialog.locator("ol li strong").first().innerText()).trim()}`)
    await page.waitForTimeout(2500)
  })

  await scene(5, page, async () => {
    await page.keyboard.press("Escape").catch(() => {})
    await page.goto("https://github.com/TheWeirdDee/muniment/blob/main/docs/testing.md#live-proof-campaign-npm-run-proof", { waitUntil: "domcontentloaded" })
    await caption(page, lines[4])
    await page.waitForTimeout(1500)
    await page.getByText("P2b").first().scrollIntoViewIfNeeded().catch(() => {})
  })

  await scene(6, page, async (notes) => {
    const host = new URL(BASE).host
    let blocked = 0
    await context.route(`**://${host}/**`, (r) => {
      blocked++
      return r.abort("blockedbyclient")
    })
    await page.goto(pathToFileURL(join(ROOT, "reader", "reader.html")).href)
    await caption(page, lines[5])
    await page.locator("#net").getByText(/Connected/).waitFor({ timeout: 60_000 })
    await page.locator("#key").fill(key("r01"))
    await page.getByRole("button", { name: "Read record" }).click()
    await page.locator("#detail").getByText(/Synthetic test record/).waitFor({ timeout: 60_000 })
    notes.push(`requests to ${host} blocked: ${blocked}`)
  })

  await scene(7, page, async () => {
    await page.goto(DASH, { waitUntil: "domcontentloaded" })
    await caption(page, lines[6])
    await page.locator("#coverage").getByText(/live synthetic replies/).waitFor({ timeout: 60_000 })
    await page.waitForTimeout(1500)
    await page.locator("#h-outcomes").scrollIntoViewIfNeeded()
  })

  await scene(8, page, async () => {
    await page.setContent(`<html><body style="margin:0;background:#111114;color:#f0eadc;font-family:system-ui;display:grid;place-items:center;height:100vh">
      <div style="max-width:980px;padding:40px">
        <div style="font-size:64px;font-weight:800;letter-spacing:-.03em;line-height:1">PUBLIC ANSWERS.<br><span style="color:#ffd95d">WORTH KEEPING.</span></div>
        <p style="font-size:22px;margin-top:28px">github.com/TheWeirdDee/muniment · muniment-archive.vercel.app</p>
        <p style="font-size:16px;color:#c9c2b0">Synthetic records on Arkiv Tiramisu. Renewal tx in this film: ${wallet.sent.join(", ") || "none"}</p>
        <p style="font-size:16px;color:#c9c2b0">Evidence: docs/testing.md · arkiv/schema.md · arkiv/friction.md</p>
      </div></body></html>`)
    await caption(page, lines[7])
  })

  await page.close()
  await context.close()
  await browser.close()
  const webm = readdirSync(OUT).filter((f) => f.endsWith(".webm") && f !== "raw.webm")
  renameSync(join(OUT, webm[webm.length - 1]), join(OUT, "raw.webm"))
  writeFileSync(join(OUT, "scenes.json"), JSON.stringify({ base: BASE, recordedAt: new Date().toISOString(), renewalTx: wallet.sent, scenes }, null, 2))
  const ts = (ms: number) => {
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(x).padStart(3, "0")}`
  }
  writeFileSync(join(OUT, "captions.srt"), scenes.map((s, i) => `${i + 1}\n${ts(s.startMs)} --> ${ts(s.endMs)}\n${s.text}\n`).join("\n"))
  console.log(`total ${(scenes[scenes.length - 1].endMs / 1000).toFixed(1)} s; renewal ${wallet.sent.join(",")}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
