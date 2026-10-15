// Writes per-route HTML with route-specific <title>, description, canonical and Open Graph tags so
// crawlers and link previews get correct metadata without running JavaScript. Also writes the
// sitemap, robots policy, record-page shell and 404 page. Runs after `vite build`.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, "..", "dist")
const SITE = process.env.VITE_SITE_URL || "https://muniment-archive.vercel.app"
const shell = readFileSync(join(dist, "index.html"), "utf8")

const routes = [
  ["/", "Muniment — keep public answers available", "Search, cite and help preserve government replies on Arkiv. Anyone can renew a record without being able to change it, and independent tools can read it. Synthetic testnet edition."],
  ["/archive", "Search the archive · Muniment", "Filter synthetic government replies by authority, outcome, exemption section, filing date and response time. Results come straight from Arkiv."],
  ["/preserve", "Preserve queue · Muniment", "Synthetic records approaching their Arkiv expiry block, with batch renewal from any wallet."],
  ["/collections", "Collections · Muniment", "Browser-only collections of synthetic records with export, import and renewal planning."],
  ["/publish", "Publish a synthetic record · Muniment", "Publish a templated synthetic reply to Arkiv with the read-only and permissionless-extension flags, signed by your own wallet."],
  ["/insights", "Insights · Muniment", "Counts of synthetic replies by authority and outcome, read live from Arkiv, plus the separately hosted response-time dashboard."],
  ["/developers", "Developers · Muniment", "Muniment's public data contract on Arkiv: entity types, attributes, expiry policy, exact queries, the muniment-query package and the standalone reader."],
  ["/how-it-works", "How it works · Muniment", "What Muniment stores on Arkiv, who can renew or change it, how provenance and renewal verification work, and the limits of each guarantee."],
  ["/privacy", "Privacy · Muniment", "What Muniment stores in your browser, what becomes public on Arkiv, and what the hosting provider may log."],
  ["/terms", "Terms of use · Muniment", "Terms for using the Muniment hackathon edition on the Arkiv Tiramisu testnet."],
]

const esc = (s) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")

function page(path, title, description, { noindex = false } = {}) {
  let html = shell
  const url = `${SITE}${path === "/" ? "/" : path}`
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
  html = html.replaceAll("https://muniment-archive.vercel.app", SITE)
  if (noindex) html = html.replace("</title>", '</title>\n    <meta name="robots" content="noindex, follow" />')
  return html
}

for (const [path, title, description] of routes) {
  const out = path === "/" ? join(dist, "index.html") : join(dist, path.slice(1), "index.html")
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, page(path, title, description))
}

// Record pages: one shared shell. Synthetic record pages are kept out of search indexes.
mkdirSync(join(dist, "records"), { recursive: true })
writeFileSync(
  join(dist, "records", "record-shell.html"),
  page("/records", "Synthetic record · Muniment", "A synthetic Muniment record read live from Arkiv: claimed issuer, on-chain publisher, review status and expiry.", { noindex: true }),
)
writeFileSync(join(dist, "404.html"), page("/404", "Page not found · Muniment", "This address does not match a Muniment page.", { noindex: true }))

writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map(([p]) => `  <url><loc>${SITE}${p === "/" ? "/" : p}</loc></url>`)
    .join("\n")}\n</urlset>\n`,
)
writeFileSync(join(dist, "robots.txt"), `# Record pages carry noindex; they stay crawlable so that tag is seen.\nUser-agent: *\nAllow: /\nSitemap:${SITE}/sitemap.xml\n`)

// The standalone reader is published unchanged at /reader.html.
copyFileSync(join(here, "..", "..", "..", "reader", "reader.html"), join(dist, "reader.html"))
console.log(`prerendered ${routes.length} routes, record shell, 404, sitemap, robots, reader`)
