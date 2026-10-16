// Real-browser layout audit. No record fixtures or simulated transaction results.
// node scripts/visual-audit.mjs [base URL] [output directory]
import { chromium } from "@playwright/test"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
const base = process.argv[2] || "https://muniment-archive.vercel.app"
const out = process.argv[3] || "evidence/visual-audit"
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]
const manifest = JSON.parse(readFileSync("evidence/manifest.json", "utf8"))
const key = manifest.entries.find((e) => e.id === "r01" && e.kind === "reply").key
const routes = ["/", "/archive", "/preserve", "/collections", "/publish", "/developers", "/how-it-works", "/privacy", "/terms", "/reader.html", `/records/${key}`, process.env.DASHBOARD_URL || "https://muniment-insights.vercel.app/"]
const results = []
for (const theme of ["dark", "light"]) {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width >= 1024 ? 720 : 844 }, reducedMotion: "reduce", colorScheme: theme })
    await context.addInitScript((theme) => { localStorage.setItem("muniment.theme", theme); localStorage.setItem("muniment.insights.theme", theme) }, theme)
    const page = await context.newPage()
    for (const route of routes) {
      await page.goto(route.startsWith("https:") ? route : base + route, { waitUntil: "load" })
      await page.evaluate(() => document.fonts.ready)
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        heading: document.querySelector("h1")?.textContent,
        renderedTheme: document.documentElement.dataset.theme,
        overflowing: [...document.querySelectorAll("body *")].filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== "fixed"
        }).slice(0, 8).map((el) => `${el.tagName}.${el.className}`),
      }))
      results.push({ width, height: width >= 1024 ? 720 : 844, theme, reducedMotion: true, route, ...layout })
      if (route === "/") await page.screenshot({ path: `${out}/home-${width}-${theme}-reduced.png`, fullPage: true })
    }
    await context.close()
    console.log(`${theme} ${width}: ${results.filter((r) => r.width === width && r.theme === theme && r.overflow > 0).length} overflow failures`)
    writeFileSync(`${out}/results.json`, JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2))
  }
}
const context = await browser.newContext({ viewport: { width: 1440, height: 720 }, recordVideo: { dir: `${out}/motion`, size: { width: 1440, height: 720 } } })
const page = await context.newPage()
await page.goto(base)
await page.locator(".stage .record-card a").first().waitFor({ timeout: 30_000 }).catch(() => {})
await page.screenshot({ path: `${out}/home-1440-dark-motion-fold.png` })
for (let y = 0; y < 6500; y += 350) { await page.mouse.wheel(0, 350); await page.waitForTimeout(300) }
await page.locator(".stage .record-card").first().hover().catch(() => {})
await page.waitForTimeout(1000)
await context.close()
await browser.close()
console.log(`Saved ${results.length} route/viewport/theme checks and a motion recording to ${out}`)
process.exitCode = results.some((r) => r.overflow > 0) ? 1 : 0
