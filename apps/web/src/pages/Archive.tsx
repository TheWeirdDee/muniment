import { type DecodeIssue, OUTCOMES, OUTCOME_LABELS, type Outcome, type Reply, type ReplyFilters, isValidSection, replyQuery, inclusiveUtcRange } from "muniment-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ReplyRow } from "../components/RecordBits"
import { CopyButton, Notice, Skeleton } from "../components/ui"
import { useAnnounce } from "../lib/announce"
import { readErrorMessage, reader } from "../lib/arkiv"
import { TRUSTED_PUBLISHERS } from "../lib/config"
import { plural } from "../lib/format"
import { useHead } from "../lib/hooks"
import { usePageMeta } from "../lib/meta"
import { settings } from "../lib/settings"
import { AUTHORITIES, JURISDICTIONS, SECTIONS, TOPICS } from "../lib/vocab"

const PAGE = 25

type Parsed = { filters: ReplyFilters; section: string | null; text: string; sort: "chain" | "filed-desc" | "filed-asc" | "slowest"; ignored: string[]; dateError: string | null }

function parse(sp: URLSearchParams): Parsed {
  const ignored: string[] = []
  const f: ReplyFilters = {}
  let dateError: string | null = null
  const pick = (name: string, ok: (v: string) => boolean, assign: (v: string) => void) => {
    const v = sp.get(name)
    if (v === null || v === "") return
    if (ok(v)) assign(v)
    else ignored.push(`${name}=${v.slice(0, 40)}`)
  }
  pick("authority", (v) => /^[a-z0-9-]{1,64}$/.test(v), (v) => (f.authority = v))
  pick("jurisdiction", (v) => /^[a-z0-9-]{1,64}$/.test(v), (v) => (f.jurisdiction = v))
  pick("topic", (v) => /^[a-z0-9-]{1,64}$/.test(v), (v) => (f.topic = v))
  pick("outcome", (v) => (OUTCOMES as readonly string[]).includes(v), (v) => (f.outcome = v as Outcome))
  try {
    const range = inclusiveUtcRange(sp.get("from") ?? "", sp.get("to") ?? "")
    f.filedFromMs = range.from
    f.filedToMs = range.through
  } catch (err) { dateError = (err as Error).message }
  pick("rmin", (v) => /^\d{1,4}$/.test(v), (v) => (f.responseDaysMin = Number(v)))
  pick("rmax", (v) => /^\d{1,4}$/.test(v), (v) => (f.responseDaysMax = Number(v)))
  let section: string | null = null
  pick("section", isValidSection, (v) => (section = v))
  const sortRaw = sp.get("sort") ?? "chain"
  const sort = (["chain", "filed-desc", "filed-asc", "slowest"] as const).find((s) => s === sortRaw) ?? "chain"
  if (sortRaw !== sort) ignored.push(`sort=${sortRaw.slice(0, 20)}`)
  const known = new Set(["authority", "jurisdiction", "topic", "outcome", "from", "to", "rmin", "rmax", "section", "q", "sort"])
  for (const k of sp.keys()) if (!known.has(k)) ignored.push(k)
  return { filters: f, section, text: (sp.get("q") ?? "").slice(0, 100), sort, ignored, dateError }
}

function matchesLocal(r: Reply, f: ReplyFilters): boolean {
  if (f.authority && r.authority !== f.authority) return false
  if (f.jurisdiction && r.jurisdiction !== f.jurisdiction) return false
  if (f.topic && r.topic !== f.topic) return false
  if (f.outcome && r.outcome !== f.outcome) return false
  if (f.filedFromMs !== undefined && r.filedMs < f.filedFromMs) return false
  if (f.filedToMs !== undefined && r.filedMs > f.filedToMs) return false
  if (f.responseDaysMin !== undefined && (r.responseDays === null || r.responseDays < f.responseDaysMin)) return false
  if (f.responseDaysMax !== undefined && (r.responseDays === null || r.responseDays > f.responseDaysMax)) return false
  return true
}

export default function Archive() {
  usePageMeta("Search the archive", "Filter synthetic government replies by authority, outcome, exemption section, filing date and response time. Results come straight from Arkiv.", { path: "/archive" })
  const [sp, setSp] = useSearchParams()
  const parsed = useMemo(() => parse(sp), [sp])
  const { anyPublisher } = settings.use()
  const creators = anyPublisher ? undefined : TRUSTED_PUBLISHERS
  const filters = useMemo<ReplyFilters>(() => ({ ...parsed.filters, creators }), [parsed.filters, creators])
  const { head } = useHead()
  const announce = useAnnounce()
  const [records, setRecords] = useState<Reply[]>([])
  const [issues, setIssues] = useState<DecodeIssue[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [state, setState] = useState<"loading" | "ready" | "error" | "more">("loading")
  const [error, setError] = useState<string | null>(null)
  const [block, setBlock] = useState<bigint | null>(null)
  const [sectionNote, setSectionNote] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 961px)").matches)
  useEffect(() => {
    // On wide screens the filters are a sidebar with no toggle, so they must always be open.
    const mq = window.matchMedia("(min-width: 961px)")
    const onChange = () => mq.matches && setFiltersOpen(true)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  const key = JSON.stringify(filters, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) + (parsed.section ?? "") + (parsed.dateError ?? "")

  const load = useCallback(
    async (more: boolean) => {
      ctl.current?.abort()
      if (parsed.dateError) { setRecords([]); setCursor(undefined); setError(parsed.dateError); setState("error"); return }
      const c = new AbortController()
      ctl.current = c
      setState(more ? "more" : "loading")
      setError(null)
      try {
        const r = reader(c.signal)
        if (parsed.section) {
          const { keys, complete } = await r.replyKeysForSection(parsed.section, creators, c.signal)
          const got = await r.getReplies(keys, c.signal)
          const filtered = got.records.filter((x) => matchesLocal(x, parsed.filters) && (!creators || creators.some((t) => t.toLowerCase() === x.creator?.toLowerCase())))
          setRecords(filtered)
          setIssues(got.issues)
          setCursor(undefined)
          setSectionNote(
            `Section filter reads exemption relation records, which cover primary and secondary sections. Other filters were applied in your browser to those ${keys.length} replies.${complete ? "" : " The relation scan hit its bound, so the list may be incomplete."}`,
          )
          setBlock(null)
        } else {
          const page = await r.searchReplies(filters, { limit: PAGE, cursor: more ? cursor : undefined, atBlock: more ? block ?? undefined : undefined, signal: c.signal })
          setSectionNote(null)
          setRecords((prev) => {
            const merged = more ? [...prev] : []
            const seen = new Set(merged.map((x) => x.key))
            for (const x of page.records) if (!seen.has(x.key)) merged.push(x)
            return merged
          })
          setIssues((prev) => (more ? [...prev, ...page.issues] : page.issues))
          setCursor(page.cursor)
          setBlock(page.blockNumber)
        }
        if (!c.signal.aborted) setState("ready")
      } catch (e) {
        if (c.signal.aborted) return
        setError(readErrorMessage(e))
        setState("error")
      }
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: key captures filter identity
    [key, cursor, block],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the filter key changes
  useEffect(() => {
    load(false)
    return () => ctl.current?.abort()
  }, [key])

  const visible = useMemo(() => {
    const t = parsed.text.trim().toLowerCase()
    let list = t
      ? records.filter((r) =>
          [r.payload.title, r.payload.question, r.payload.answer ?? "", r.payload.authorityName, r.reference].join(" ").toLowerCase().includes(t),
        )
      : records
    if (parsed.sort !== "chain") {
      list = [...list].sort((a, b) =>
        parsed.sort === "filed-desc" ? b.filedMs - a.filedMs : parsed.sort === "filed-asc" ? a.filedMs - b.filedMs : (b.responseDays ?? -1) - (a.responseDays ?? -1),
      )
    }
    return list
  }, [records, parsed.text, parsed.sort])

  useEffect(() => {
    if (state === "ready") announce(`${plural(visible.length, "record")} shown${cursor ? ", more available" : ""}.`)
  }, [state, visible.length, cursor, announce])

  const update = (name: string, value: string) => {
    const next = new URLSearchParams(sp)
    if (value) next.set(name, value)
    else next.delete(name)
    setSp(next, { replace: false })
  }

  const v = (n: string) => sp.get(n) ?? ""
  const activeCount = [...sp.keys()].filter((k) => k !== "sort").length
  const query = parsed.section ? null : replyQuery(filters)

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Archive</span>
          <h1>Find replies by authority, topic or outcome.</h1>
          <p className="lede">
            Every result is read live from Arkiv in your browser. Text search covers only the records loaded so far; the exact query sits in an
            expandable panel below the results.
          </p>
        </div>
      </section>
      <div className="wrap archive-layout">
        <aside className="filters" aria-label="Filters">
          <details
            className="filters-disclosure"
            open={filtersOpen}
            onToggle={(e) => setFiltersOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="filters-summary">
              Filters{activeCount ? ` (${activeCount} active)` : ""}
            </summary>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
            }}
          >
            <div className="field">
              <label htmlFor="f-q">Text in loaded records</label>
              <input id="f-q" className="input" type="search" value={v("q")} onChange={(e) => update("q", e.target.value)} placeholder="e.g. resurfacing" />
              <span className="hint">Searches only records already downloaded ({records.length}). It is not a full-archive index.</span>
            </div>
            <div className="field">
              <label htmlFor="f-authority">Authority</label>
              <select id="f-authority" className="select" value={v("authority")} onChange={(e) => update("authority", e.target.value)}>
                <option value="">Any authority</option>
                {AUTHORITIES.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name} (synthetic)
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-jur">Jurisdiction</label>
              <select id="f-jur" className="select" value={v("jurisdiction")} onChange={(e) => update("jurisdiction", e.target.value)}>
                <option value="">Any jurisdiction</option>
                {JURISDICTIONS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-topic">Topic</label>
              <select id="f-topic" className="select" value={v("topic")} onChange={(e) => update("topic", e.target.value)}>
                <option value="">Any topic</option>
                {TOPICS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-outcome">Outcome</label>
              <select id="f-outcome" className="select" value={v("outcome")} onChange={(e) => update("outcome", e.target.value)}>
                <option value="">Any outcome</option>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABELS[o]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-section">Exemption section cited</label>
              <select id="f-section" className="select" value={v("section")} onChange={(e) => update("section", e.target.value)}>
                <option value="">Any or none</option>
                {SECTIONS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label">Filed from / through (UTC dates, inclusive)</legend>
              <div className="two-col">
                <input aria-label="Filed from" className="input" type="date" value={v("from")} onChange={(e) => update("from", e.target.value)} />
                <input aria-label="Filed to" className="input" type="date" value={v("to")} onChange={(e) => update("to", e.target.value)} />
              </div>
            </fieldset>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label">Completed response time (days)</legend>
              <div className="two-col">
                <input aria-label="Minimum days" className="input" inputMode="numeric" pattern="[0-9]*" placeholder="min" value={v("rmin")} onChange={(e) => update("rmin", e.target.value.replace(/\D/g, "").slice(0, 4))} />
                <input aria-label="Maximum days" className="input" inputMode="numeric" pattern="[0-9]*" placeholder="max" value={v("rmax")} onChange={(e) => update("rmax", e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </div>
              <span className="hint">Unanswered replies have no response time and are excluded by this filter. Use Outcome → "No reply recorded" for them.</span>
            </fieldset>
            <button type="button" className="btn btn-sm" onClick={() => setSp(new URLSearchParams(), { replace: false })} disabled={activeCount === 0}>
              Clear all filters
            </button>
          </form>
          </details>
        </aside>

        <section className="results" aria-labelledby="results-h">
          <div className="results-head">
            <h2 id="results-h" className="visually-hidden">
              Results
            </h2>
            <p aria-live="off">
              {state === "loading" ? "Loading…" : `${plural(visible.length, "record")} shown`}
              {records.length !== visible.length ? <span className="faint"> of {records.length} loaded</span> : null}
              {cursor ? <span className="faint"> · more on Arkiv</span> : null}
            </p>
            <div className="field" style={{ minWidth: "13rem" }}>
              <label htmlFor="f-sort" className="visually-hidden">
                Order
              </label>
              <select id="f-sort" className="select" value={parsed.sort} onChange={(e) => update("sort", e.target.value === "chain" ? "" : e.target.value)}>
                <option value="chain">Newest published first</option>
                <option value="filed-desc">Filing date, newest (loaded only)</option>
                <option value="filed-asc">Filing date, oldest (loaded only)</option>
                <option value="slowest">Slowest response (loaded only)</option>
              </select>
            </div>
          </div>
          {parsed.ignored.length > 0 ? <Notice tone="warn" title="Some link parameters were ignored">{parsed.ignored.join(", ")} are not valid filters.</Notice> : null}
          {anyPublisher ? (
            <Notice tone="warn" title="Showing every wallet">
              Records from wallets this deployment does not trust are included and labelled. Anyone can copy Muniment's namespace.
            </Notice>
          ) : null}
          {parsed.sort !== "chain" && cursor ? <Notice tone="info">Sorting applies to the {records.length} records loaded so far, not the whole archive. Load more to widen it.</Notice> : null}
          {sectionNote ? <Notice tone="info">{sectionNote}</Notice> : null}
          {state === "error" ? (
            <Notice tone="danger" title="Could not load records">
              {error}{" "}
              <button type="button" className="btn btn-sm" onClick={() => load(false)}>
                Try again
              </button>
            </Notice>
          ) : null}
          {state === "loading" ? (
            <div className="stack">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : null}
          {state !== "loading" && visible.length === 0 && state !== "error" ? (
            <div className="empty">
              <h3>No matching records</h3>
              <p className="muted measure">
                {records.length > 0 ? "None of the loaded records contain that text." : "Arkiv returned no live records for these filters. Records past their expiry block no longer appear in queries."}
              </p>
              <button type="button" className="btn btn-sm" onClick={() => setSp(new URLSearchParams())}>
                Clear filters
              </button>
            </div>
          ) : null}
          <div className="reply-list">
            {visible.map((r) => (
              <ReplyRow key={r.key} reply={r} head={head} nowMs={head?.timeMs ?? Date.now()} />
            ))}
          </div>
          {cursor && state !== "loading" ? (
            <div style={{ textAlign: "center", marginTop: "var(--space-5)" }}>
              <button type="button" className="btn" onClick={() => load(true)} disabled={state === "more"}>
                {state === "more" ? "Loading…" : "Load more from Arkiv"}
              </button>
            </div>
          ) : null}
          {issues.length > 0 ? (
            <details className="disclosure" style={{ marginTop: "var(--space-5)" }}>
              <summary>{plural(issues.length, "entity", "entities")} skipped as malformed</summary>
              <div className="disclosure-body">
                <p className="faint">These entities use the namespace but fail Muniment's contract, so they are not shown as records.</p>
                <ul>
                  {issues.slice(0, 20).map((i) => (
                    <li key={i.key} className="hash">
                      {i.key.slice(0, 18)}…: {i.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}
          {query ? (
            <details className="disclosure" style={{ marginTop: "var(--space-5)" }}>
              <summary>The exact Arkiv query behind these results</summary>
              <div className="disclosure-body stack-sm">
                <pre className="code-block">{query}</pre>
                <div className="cluster">
                  <CopyButton value={query} label="Copy query" />
                  {block ? <span className="faint mono">read at block {block.toLocaleString("en-GB")}</span> : null}
                  <Link to="/developers#queries">How to run it yourself</Link>
                </div>
              </div>
            </details>
          ) : null}
        </section>
      </div>
    </>
  )
}
