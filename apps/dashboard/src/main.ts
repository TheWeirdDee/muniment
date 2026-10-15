/**
 * Muniment Insights: a second application that uses only the public data contract (arkiv/schema.md)
 * and the muniment-query package. It shares no server, API or private data with the main site.
 */
import "./styles.css"
import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { politeHttp, type ArchiveClient, OUTCOMES, OUTCOME_LABELS, type Outcome, type Reply, TIRAMISU, createArchiveReader, elapsedDays, replyQuery } from "muniment-query"

const DEFAULT_CREATORS = "0x817574740F413816636FAE23064607084e2C0604"
const NAMES: Record<string, string> = {
  "ravipur-mc": "Ravipur MC",
  "sundarvan-pwd": "Sundarvan PWD",
  "kestrel-dp": "Kestrel DP",
  "harbourline-ua": "Harbourline UA",
  "meridia-rrc": "Meridia RRC",
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const store = {
  get(k: string, d: string) {
    try {
      return localStorage.getItem(k) ?? d
    } catch {
      return d
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v)
    } catch {
      // storage unavailable: settings last for this visit
    }
  },
}

// ---- theme -------------------------------------------------------------------------------
$("theme").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme")
  const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches
  const next = dark ? "light" : "dark"
  document.documentElement.setAttribute("data-theme", next)
  store.set("muniment.insights.theme", next)
  if (last) render(last)
})

// ---- tooltip -------------------------------------------------------------------------------
const tip = $("tooltip")
function showTip(e: MouseEvent | FocusEvent, html: string[]) {
  tip.textContent = ""
  for (const line of html) {
    const d = document.createElement("div")
    d.textContent = line
    tip.appendChild(d)
  }
  tip.hidden = false
  const rect = e instanceof MouseEvent ? { x: e.clientX, y: e.clientY } : (() => {
    const r = (e.target as Element).getBoundingClientRect()
    return { x: r.right, y: r.top }
  })()
  const w = tip.offsetWidth
  tip.style.left = `${Math.min(window.innerWidth - w - 8, rect.x + 12)}px`
  tip.style.top = `${Math.max(8, rect.y - tip.offsetHeight - 10)}px`
}
const hideTip = () => {
  tip.hidden = true
}

// ---- data ----------------------------------------------------------------------------------
type Data = { records: Reply[]; complete: boolean; block: bigint | null; headMs: number; query: string; creators: string[] }
let last: Data | null = null

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const fmt = (n: number | null, d = 0) => (n === null ? "—" : n.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: 0 }))

async function load() {
  const endpoint = ($("endpoint") as HTMLInputElement).value.trim() || TIRAMISU.httpRpc
  const raw = ($("creators") as HTMLInputElement).value.trim()
  const creators = raw ? raw.split(",").map((s) => s.trim()).filter((s) => /^0x[0-9a-fA-F]{40}$/.test(s)) : []
  store.set("muniment.insights.endpoint", endpoint)
  store.set("muniment.insights.creators", raw)
  $("coverage").textContent = "Loading records from Arkiv…"
  try {
    if (!endpoint.startsWith("https://")) throw new Error("Use an https:// endpoint.")
    const client = createPublicClient({ chain: tiramisu, transport: politeHttp(endpoint, { concurrency: 2, maxWaitMs: 20_000 }) })
    const archive = createArchiveReader(client as unknown as ArchiveClient)
    const filters = { creators: creators.length ? creators : undefined }
    const [scan, head] = await Promise.all([archive.scanReplies(filters, { maxPages: 10 }), archive.head()])
    last = { records: scan.records, complete: scan.complete, block: scan.blockNumber, headMs: head.timeMs, query: replyQuery(filters), creators }
    render(last)
  } catch (err) {
    $("coverage").innerHTML = ""
    const p = document.createElement("span")
    p.className = "error"
    p.textContent = `Could not read from Arkiv: ${(err as Error).message.split("\n")[0].slice(0, 200)}. Nothing below is a cached or invented value.`
    $("coverage").appendChild(p)
  }
}

// ---- svg helpers ----------------------------------------------------------------------------
const NS = "http://www.w3.org/2000/svg"
function svg(w: number, h: number, label: string) {
  const s = document.createElementNS(NS, "svg")
  s.setAttribute("viewBox", `0 0 ${w} ${h}`)
  s.setAttribute("role", "img")
  s.setAttribute("aria-label", label)
  return s
}
function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element, text?: string) {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (text !== undefined) e.textContent = text
  parent.appendChild(e)
  return e
}
/** Horizontal bar with a 4px rounded data end and a square baseline. */
function hbarPath(x0: number, y: number, len: number, h: number) {
  const r = Math.min(4, len, h / 2)
  if (len <= 0) return ""
  return `M${x0},${y} H${x0 + len - r} Q${x0 + len},${y} ${x0 + len},${y + r} V${y + h - r} Q${x0 + len},${y + h} ${x0 + len - r},${y + h} H${x0} Z`
}
/** Vertical column with a rounded top, square at the baseline. */
function vbarPath(x: number, base: number, w: number, hgt: number) {
  const r = Math.min(4, hgt, w / 2)
  if (hgt <= 0) return ""
  const top = base - hgt
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`
}
const cssVar = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
function attachTip(el: Element, lines: string[]) {
  el.setAttribute("tabindex", "0")
  el.setAttribute("aria-label", lines.join(". "))
  el.addEventListener("mousemove", (e) => showTip(e as MouseEvent, lines))
  el.addEventListener("mouseleave", hideTip)
  el.addEventListener("focus", (e) => showTip(e as FocusEvent, lines))
  el.addEventListener("blur", hideTip)
}

// ---- render -----------------------------------------------------------------------------------
function render(d: Data) {
  const recs = d.records
  const byAuth = new Map<string, Reply[]>()
  for (const r of recs) byAuth.set(r.authority, [...(byAuth.get(r.authority) ?? []), r])
  const auths = [...byAuth.keys()].sort()
  const completed = recs.filter((r) => r.outcome !== "no-reply")
  const timed = completed.filter((r) => r.responseDays !== null)
  const unanswered = recs.filter((r) => r.outcome === "no-reply")
  const refused = recs.filter((r) => r.outcome === "denied")

  $("coverage").textContent = `${recs.length} live synthetic replies from ${d.creators.length ? `${d.creators.length} trusted publisher wallet(s)` : "any wallet"}, read at block ${d.block?.toLocaleString("en-GB") ?? "?"} (${new Date(d.headMs).toISOString().slice(0, 16).replace("T", " ")} UTC). ${d.complete ? "Every matching page was read." : "The scan stopped at its page bound: figures are a PARTIAL sample."}`
  $("query").textContent = d.query

  // tiles
  const tiles = $("tiles")
  tiles.textContent = ""
  const tile = (label: string, value: string, note: string) => {
    const t = document.createElement("div")
    t.className = "tile"
    for (const [cls, txt] of [["label", label], ["value", value], ["note", note]]) {
      const e = document.createElement("div")
      e.className = cls
      e.textContent = txt
      t.appendChild(e)
    }
    tiles.appendChild(t)
  }
  tile("Live replies", fmt(recs.length), `${auths.length} synthetic authorities`)
  tile("Median days to reply", fmt(median(timed.map((r) => r.responseDays as number)), 1), `n = ${timed.length} completed with a recorded time; ${completed.length - timed.length} missing`)
  tile("Refused", fmt(refused.length), recs.length ? `${Math.round((refused.length / recs.length) * 100)}% of ${recs.length} live replies` : "no records")
  tile("Unanswered", fmt(unanswered.length), unanswered.length ? `median wait ${fmt(median(unanswered.map((r) => elapsedDays(r.filedMs, d.headMs))))} days so far` : "none recorded")

  if (recs.length === 0) {
    for (const id of ["chart-median", "chart-outcomes", "chart-dist"]) $(id).innerHTML = '<p class="empty">No live records match this source.</p>'
    $("table").textContent = ""
    return
  }

  // chart 1: median by authority (single series, no legend)
  {
    const box = $("chart-median")
    box.textContent = ""
    const rows = auths.map((a) => {
      const t = (byAuth.get(a) ?? []).filter((r) => r.outcome !== "no-reply" && r.responseDays !== null).map((r) => r.responseDays as number)
      return { a, m: median(t), n: t.length }
    })
    const W = 720
    const left = 130
    const rowH = 34
    const H = rows.length * rowH + 30
    const max = Math.max(30, ...rows.map((r) => r.m ?? 0))
    const scale = (v: number) => (v / max) * (W - left - 70)
    const s = svg(W, H, "Median days to a completed reply by authority")
    for (const t of [0, 10, 20, 30, 40, 50, 60].filter((t) => t <= max)) {
      node("line", { x1: left + scale(t), x2: left + scale(t), y1: 0, y2: H - 22, stroke: cssVar("--grid"), "stroke-width": 1 }, s)
      node("text", { x: left + scale(t), y: H - 6, "text-anchor": "middle" }, s, String(t))
    }
    rows.forEach((r, i) => {
      const y = i * rowH + 6
      node("text", { x: left - 10, y: y + 15, "text-anchor": "end", class: "label-strong" }, s, NAMES[r.a] ?? r.a)
      if (r.m !== null) {
        node("path", { d: hbarPath(left, y + 3, scale(r.m), 18), fill: cssVar("--bar") }, s)
        node("text", { x: left + scale(r.m) + 8, y: y + 16 }, s, `${fmt(r.m, 1)} d · n=${r.n}`)
      } else {
        node("text", { x: left + 6, y: y + 16 }, s, "no completed replies")
      }
      const hit = node("rect", { x: 0, y, width: W, height: rowH - 2, class: "bar-hit" }, s)
      attachTip(hit, [NAMES[r.a] ?? r.a, r.m === null ? "No completed reply with a recorded time" : `Median ${fmt(r.m, 1)} days`, `n = ${r.n} completed replies`])
    })
    box.appendChild(s)
  }

  // chart 2: outcomes by authority as a single-hue heatmap (share of each authority's records)
  {
    $("legend").textContent = ""
    const box = $("chart-outcomes")
    box.textContent = ""
    const wrap = document.createElement("div")
    wrap.className = "table-wrap"
    const t = document.createElement("table")
    t.className = "heat"
    const cap = document.createElement("caption")
    cap.className = "sub"
    cap.style.textAlign = "left"
    cap.textContent = "Each cell: number of replies (share of that authority's live replies). Darker means a larger share."
    t.appendChild(cap)
    const hr = t.createTHead().insertRow()
    const corner = document.createElement("th")
    corner.textContent = "Authority"
    hr.appendChild(corner)
    for (const o of OUTCOMES) {
      const th = document.createElement("th")
      th.scope = "col"
      th.textContent = OUTCOME_LABELS[o]
      hr.appendChild(th)
    }
    const nth = document.createElement("th")
    nth.scope = "col"
    nth.textContent = "n"
    hr.appendChild(nth)
    const tb = t.createTBody()
    for (const a of auths) {
      const list = byAuth.get(a) ?? []
      const row = tb.insertRow()
      const th = document.createElement("th")
      th.scope = "row"
      th.textContent = NAMES[a] ?? a
      row.appendChild(th)
      for (const o of OUTCOMES as readonly Outcome[]) {
        const n = list.filter((r) => r.outcome === o).length
        const share = list.length ? n / list.length : 0
        const td = row.insertCell()
        td.textContent = n === 0 ? "0" : `${n} (${Math.round(share * 100)}%)`
        if (n === 0) td.className = "zero"
        else {
          const alpha = 0.18 + share * 0.82
          td.style.background = `rgba(var(--heat), ${alpha.toFixed(2)})`
          td.style.color = alpha > 0.55 ? "var(--heat-ink)" : "var(--ink)"
        }
        td.title = `${NAMES[a] ?? a}: ${OUTCOME_LABELS[o]} ${n} of ${list.length}`
      }
      const nc = row.insertCell()
      nc.textContent = String(list.length)
    }
    wrap.appendChild(t)
    box.appendChild(wrap)
  }

  // chart 3: histogram
  {
    const box = $("chart-dist")
    box.textContent = ""
    const vals = timed.map((r) => r.responseDays as number)
    const maxV = Math.max(60, ...vals)
    const bins: { lo: number; hi: number; n: number }[] = []
    for (let lo = 0; lo <= maxV; lo += 10) bins.push({ lo, hi: lo + 9, n: vals.filter((v) => v >= lo && v <= lo + 9).length })
    const W = 720
    const H = 240
    const base = H - 30
    const left = 36
    const bw = (W - left - 10) / bins.length
    const maxN = Math.max(1, ...bins.map((b) => b.n))
    const yScale = (n: number) => (n / maxN) * (base - 20)
    const s = svg(W, H, "Distribution of completed response times in 10-day bins")
    const step = maxN <= 5 ? 1 : Math.ceil(maxN / 5)
    for (let t = 0; t <= maxN; t += step) {
      node("line", { x1: left, x2: W - 10, y1: base - yScale(t), y2: base - yScale(t), stroke: cssVar("--grid"), "stroke-width": 1 }, s)
      node("text", { x: left - 8, y: base - yScale(t) + 4, "text-anchor": "end" }, s, String(t))
    }
    bins.forEach((b, i) => {
      const x = left + i * bw + 2
      const w = Math.min(24, bw - 4)
      const cx = x + (bw - 4 - w) / 2
      if (b.n > 0) node("path", { d: vbarPath(cx, base, w, yScale(b.n)), fill: cssVar("--bar") }, s)
      node("text", { x: x + (bw - 4) / 2, y: base + 16, "text-anchor": "middle" }, s, `${b.lo}–${b.hi}`)
      const hit = node("rect", { x: x, y: 0, width: bw - 2, height: base, class: "bar-hit" }, s)
      attachTip(hit, [`${b.lo}–${b.hi} days`, `${b.n} completed replies`])
    })
    const x30 = left + 3 * bw
    node("line", { x1: x30, x2: x30, y1: 6, y2: base, stroke: cssVar("--ink-3"), "stroke-width": 1 }, s)
    node("text", { x: x30 + 6, y: 16 }, s, "30 days (descriptive marker)")
    box.appendChild(s)
  }

  // table
  {
    const t = $<HTMLTableElement>("table")
    t.textContent = ""
    const head = t.createTHead().insertRow()
    for (const h of ["Authority (synthetic)", "Live replies", "Completed", "Median days", "Missing time", ...OUTCOMES.map((o) => OUTCOME_LABELS[o]), "Median wait, unanswered"]) {
      const th = document.createElement("th")
      th.scope = "col"
      th.textContent = h
      if (h !== "Authority (synthetic)") th.className = "num"
      head.appendChild(th)
    }
    const body = t.createTBody()
    for (const a of auths) {
      const list = byAuth.get(a) ?? []
      const comp = list.filter((r) => r.outcome !== "no-reply")
      const tm = comp.filter((r) => r.responseDays !== null).map((r) => r.responseDays as number)
      const un = list.filter((r) => r.outcome === "no-reply").map((r) => elapsedDays(r.filedMs, d.headMs))
      const row = body.insertRow()
      const th = document.createElement("th")
      th.scope = "row"
      th.textContent = NAMES[a] ?? a
      row.appendChild(th)
      for (const v of [list.length, comp.length, fmt(median(tm), 1), comp.length - tm.length, ...OUTCOMES.map((o) => list.filter((r) => r.outcome === o).length), un.length ? fmt(median(un)) : "—"]) {
        const td = row.insertCell()
        td.className = "num"
        td.textContent = String(v)
      }
    }
  }
}

;($("endpoint") as HTMLInputElement).value = store.get("muniment.insights.endpoint", TIRAMISU.httpRpc)
;($("creators") as HTMLInputElement).value = store.get("muniment.insights.creators", DEFAULT_CREATORS)
$("controls").addEventListener("submit", (e) => {
  e.preventDefault()
  load()
})
load()
