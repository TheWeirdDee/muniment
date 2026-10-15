// Capture route screenshots for before/after comparison.
//   node scripts/shots.mjs <baseUrl> <outDir> [--theme=light|dark] [--reduced] [--widths=1440,390] [--routes=/,/archive]
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
const [base, out, ...flags] = process.argv.slice(2)
const flag = (n, d) => flags.find((f) => f.startsWith(`--${n}=`))?.split("=")[1] ?? d
const theme = flag("theme", "dark")
const reduced = flags.includes("--reduced")
const widths = flag("widths", "1440,390").split(",").map(Number)
const routes = flag("routes", "/,/archive,/preserve,/collections,/publish,/insights,/developers,/how-it-works").split(",")
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
const report = []
for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : w < 1100 ? 1024 : 900 }, colorScheme: theme, reducedMotion: reduced ? "reduce" : "no-preference" })
  for (const r of routes) {
    const p = await ctx.newPage()
    const errors = []
    p.on("pageerror", (e) => errors.push(e.message))
    p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)))
    await p.goto(base + r, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {})
    await p.waitForTimeout(2500)
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((s) => setTimeout(s, 60)) } window.scrollTo(0, 0) })
    await p.waitForTimeout(700)
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const name = `${(r.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home")}-${w}-${theme}${reduced ? "-reduced" : ""}`
    await p.screenshot({ path: `${out}/${name}.png`, fullPage: true })
    await p.screenshot({ path: `${out}/${name}-fold.png` })
    report.push({ route: r, width: w, theme, overflow, errors })
    await p.close()
  }
  await ctx.close()
}
await b.close()
console.log(JSON.stringify(report.filter((x) => x.overflow > 0 || x.errors.length), null, 1), `\n${report.length} captures`)
