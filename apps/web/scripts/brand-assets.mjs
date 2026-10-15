// Renders Muniment's raster brand assets (favicons, touch icon, OG card) from the SVG mark and
// the self-hosted fonts. Run: node apps/web/scripts/brand-assets.mjs
import { chromium } from "@playwright/test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const pub = join(here, "..", "public")
const root = join(here, "..", "..", "..")
const font = (p) => `data:font/woff2;base64,${readFileSync(join(root, "node_modules", p)).toString("base64")}`
const favicon = readFileSync(join(pub, "favicon.svg"), "utf8")
const mark = readFileSync(join(pub, "mark.svg"), "utf8")

const browser = await chromium.launch()
const page = await browser.newPage()

for (const [name, size, pad, bg] of [
  ["favicon-32.png", 32, 0, "transparent"],
  ["icon-192.png", 192, 28, "#111114"],
  ["icon-512.png", 512, 72, "#111114"],
  ["apple-touch-icon.png", 180, 26, "#111114"],
]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">
      <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${(bg === "transparent" ? favicon : favicon).replace("<svg", '<svg width="100%" height="100%"')}</div>
    </body></html>`,
  )
  await page.screenshot({ path: join(pub, name), omitBackground: bg === "transparent" })
}

await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(`<!doctype html><html><head><style>
@font-face{font-family:A;src:url(${font("@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2")}) format("woff2-variations");font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:M;src:url(${font("@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2")}) format("woff2-variations");font-weight:100 900}
body{margin:0;width:1200px;height:630px;background:#111114;color:#f0eadc;font-family:A;overflow:hidden;position:relative}
.brand{position:absolute;left:72px;top:60px;display:flex;align-items:center;gap:16px;font-weight:700;font-size:34px;letter-spacing:-.02em}
.brand svg{width:44px;height:44px}
h1{position:absolute;left:72px;top:150px;margin:0;font-weight:800;font-stretch:70%;font-variation-settings:"wdth" 70;text-transform:uppercase;font-size:100px;line-height:.92;white-space:nowrap;letter-spacing:-.035em}
h1 span{color:#ffd95d;display:block}
.strip{position:absolute;left:0;right:0;bottom:0;height:86px;background:#ffd95d;color:#111114;display:flex;align-items:center;padding:0 72px;font-family:M;font-size:22px;letter-spacing:.06em;text-transform:uppercase;justify-content:space-between}
.card{position:absolute;right:56px;top:150px;width:250px;height:290px;background:#576238;transform:rotate(3deg)}
.paper{position:absolute;right:78px;top:200px;width:262px;padding:28px;background:#f0eadc;color:#141416;border:1px solid rgba(17,17,20,.2);border-radius:8px;box-shadow:0 24px 50px -20px rgba(0,0,0,.8);transform:rotate(-2deg);font-size:26px;line-height:1.2}
.paper small{display:block;font-family:M;font-size:13px;letter-spacing:.14em;color:#5d5a54;margin-bottom:14px}
</style></head><body>
<div class="brand">${favicon.replace("<svg", '<svg width="44" height="44"')}Muniment</div>
<h1>Public answers.<br><span>Worth<br>keeping.</span></h1>
<div class="card"></div>
<div class="paper"><small>SYNTHETIC RECORD · ARKIV TESTNET</small>Find government replies, save related records and help keep them available.</div>
<div class="strip"><span>Synthetic records · Arkiv Tiramisu testnet</span><span>Open source</span></div>
</body></html>`)
await page.waitForTimeout(400)
await page.screenshot({ path: join(pub, "og.png") })
await browser.close()
console.log("brand assets written to", pub)
