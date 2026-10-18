import { type ArchiveClient, BLOCKS_PER_DAY, type Hex, type Linked, OUTCOME_LABELS, type Reply, SEAL_ADDRESS, decodeReply, expiringQuery, scan } from "muniment-query"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { ExpiryText, StatusPill } from "../components/RecordBits"
import { RenewDialog } from "../components/RenewDialog"
import { Arrow, ExternalLink, Skeleton } from "../components/ui"
import { publicClient, readErrorMessage, reader } from "../lib/arkiv"
import { DASHBOARD_URL, TRUSTED_PUBLISHERS } from "../lib/config"
import { type HeadAnchor, blockToMs, formatDate, sameAddress, shortHex, walletLabel } from "../lib/format"
import { fetchHead, useAsync, useHead, useReveal } from "../lib/hooks"
import { usePageMeta } from "../lib/meta"
import { AUTHORITIES, TOPICS } from "../lib/vocab"

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  )
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

function sourceStatus(r: Reply) {
  return r.payload.claimedSource.status === "url-claimed" ? "Points to a synthetic source file" : "Synthetic record · no live source"
}

function useSample() {
  return useAsync(async (signal) => {
    const r = reader()
    const page = await r.searchReplies({ creators: TRUSTED_PUBLISHERS, outcome: "partial" }, { limit: 1, signal })
    const reply = page.records.find((x) => x.payload.claimedSource.status === "url-claimed") ?? page.records[0] ?? null
    if (!reply) return { reply: null, linked: null as Linked | null, status: null }
    // Linked reviews load on the detail page, not for a decorative homepage preview.
    return { reply, linked: null as Linked | null, status: null }
  }, [])
}

/** The hero's one real product preview: a live record, or an honest empty/loading/error state. */
function RecordPreview({ state, head }: { state: ReturnType<typeof useSample>; head: HeadAnchor | null }) {
  if (state.status === "loading" && !state.data) {
    return (
      <div className="stage" role="group" aria-busy="true" aria-label="Loading a record from Arkiv">
        <div className="stage-card record-card">
          <Skeleton lines={4} />
        </div>
      </div>
    )
  }
  if (state.status === "error") {
    return (
      <div className="stage">
        <div className="stage-card record-card">
          <span className="eyebrow">What you can do with Muniment</span>
          <p className="record-card-title">Find a reply. Check its source. Help keep it available.</p>
          <p className="muted">Search public records, inspect the publisher and expiry, and save a collection in your browser. A different wallet can fund continued storage.</p>
          <Link to="/archive" className="link-arrow">
            Explore the archive <Arrow />
          </Link>
          <details style={{ marginTop: "var(--space-4)" }}>
            <summary>Live data is temporarily unavailable</summary>
            <p className="muted">{readErrorMessage((state as { error: unknown }).error)}</p>
            <Link to="/settings">Endpoint settings</Link>
          </details>
        </div>
      </div>
    )
  }
  const r = state.data?.reply ?? null
  if (!r) {
    return (
      <div className="stage">
        <div className="stage-card record-card">
          <span className="eyebrow">Live from Arkiv</span>
          <p className="record-card-title">No demo records are available yet.</p>
          <p className="muted">The archive is empty or every demo record has expired. Nothing here is a placeholder.</p>
        </div>
      </div>
    )
  }
  const sealed = sameAddress(r.owner, SEAL_ADDRESS)
  const until = head && r.expiresAtBlock ? LONG_DATE.format(new Date(blockToMs(r.expiresAtBlock, head))) : null
  return (
    <div className="stage" role="group" aria-label="A live record from the archive">
      <div className="stage-back" aria-hidden="true" />
      <Link to={`/records/${r.key}`} className="stage-card record-card record-card-link">
        <div className="cluster" style={{ justifyContent: "space-between" }}>
          <span className="eyebrow">Live from Arkiv · synthetic</span>
          {state.data?.status ? <StatusPill status={state.data.status} /> : null}
        </div>
        <p className="record-card-topic">{TOPICS.find((t) => t.slug === r.topic)?.name ?? r.topic}</p>
        <p className="record-card-title">{r.payload.title.replace(" (synthetic)", "")}</p>
        <dl className="record-card-facts">
          <div>
            <dt>Claimed authority</dt>
            <dd>{r.payload.authorityName}</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>{OUTCOME_LABELS[r.outcome]}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{sourceStatus(r)}</dd>
          </div>
        </dl>
        <div className="record-card-avail">
          <div>
            <span className="eyebrow">Stored until about</span>
            <strong>{until ?? "…"}</strong>
          </div>
          <ExpiryText expiresAt={r.expiresAtBlock} head={head} />
        </div>
        <p className="record-card-foot">
          Block {r.expiresAtBlock?.toLocaleString("en-GB")} · {r.permissionlessExtension ? "any wallet can renew storage" : "only the owner can renew"} ·{" "}
          {sealed ? "sealed" : "publisher can still delete"}
        </p>
        <span className="record-card-open">
          Open record <Arrow dir="ne" />
        </span>
      </Link>
    </div>
  )
}

function PreservePanel({ head }: { head: HeadAnchor | null }) {
  const [enabled, setEnabled] = useState(false)
  const data = useAsync(async (signal) => {
    if (!enabled) return [] as Reply[]
    // One small bounded query: replies expiring in the next 60 days, soonest three shown.
    const head = await fetchHead()
    const q = expiringQuery(head.block, head.block + BigInt(60 * BLOCKS_PER_DAY), TRUSTED_PUBLISHERS)
    const res = await scan<Reply>(publicClient() as unknown as ArchiveClient, q, decodeReply, { maxPages: 1, pageSize: 25, signal })
    return res.records.sort((a, b) => Number((a.expiresAtBlock ?? 0n) - (b.expiresAtBlock ?? 0n))).slice(0, 3)
  }, [enabled])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (data.data && picked.size === 0) setPicked(new Set(data.data.slice(0, 2).map((r) => r.key)))
    // biome-ignore lint/correctness/useExhaustiveDependencies: preselect once on load
  }, [data.data])
  const list = data.data ?? []
  return (
    <div className="flat-panel">
      <div className="flat-panel-head">
        <span className="eyebrow">Expiring in the next 60 days</span>
        <Link to="/preserve" className="link-arrow plain">
          Full queue <Arrow />
        </Link>
      </div>
      {data.status === "loading" && !data.data ? <Skeleton lines={3} /> : null}
      {data.status === "error" ? <p className="muted">{readErrorMessage((data as { error: unknown }).error)}</p> : null}
      {!enabled ? <button type="button" className="btn" onClick={() => setEnabled(true)}>Load live renewal candidates</button> : null}
      {enabled && data.status === "ready" && list.length === 0 ? <p className="muted">No trusted records expire in the next 60 days.</p> : null}
      <ul className="pick-list">
        {list.map((r) => (
          <li key={r.key}>
            <label className="check">
              <input
                type="checkbox"
                checked={picked.has(r.key)}
                onChange={() =>
                  setPicked((p) => {
                    const n = new Set(p)
                    if (n.has(r.key)) n.delete(r.key)
                    else n.add(r.key)
                    return n
                  })
                }
              />
              <span className="pick-text">
                <span>{r.payload.title.replace(" (synthetic)", "")}</span>
                <span className="faint">{r.payload.authorityName}</span>
              </span>
            </label>
            <ExpiryText expiresAt={r.expiresAtBlock} head={head} />
          </li>
        ))}
      </ul>
      {list.length > 0 ? (
        <div className="flat-panel-foot">
          <button type="button" className="btn btn-primary" disabled={picked.size === 0} onClick={() => setOpen(true)}>
            Renew storage for {picked.size} selected
          </button>
          <span className="faint">Opens a real quote. Nothing is signed until you approve it in your wallet.</span>
        </div>
      ) : null}
      <RenewDialog open={open} onClose={() => setOpen(false)} keys={[...picked] as Hex[]} onDone={data.reload} />
    </div>
  )
}

function ProvenancePanel({ sample }: { sample: ReturnType<typeof useSample> }) {
  const r = sample.data?.reply
  if (!r) {
    return (
      <div className="flat-panel">
        <span className="eyebrow">Provenance</span>
        <p className="muted">{sample.status === "loading" ? "Loading a live record…" : "No live record to show yet."}</p>
      </div>
    )
  }
  const reviews = sample.data?.linked?.reviews ?? []
  const label = walletLabel(r.creator)
  return (
    <div className="flat-panel">
      <div className="flat-panel-head">
        <span className="eyebrow">Provenance of the record above</span>
        <Link to={`/records/${r.key}`} className="link-arrow plain">
          Full record <Arrow />
        </Link>
      </div>
      <dl className="prov-rows">
        <div>
          <dt>Claimed authority</dt>
          <dd>
            {r.payload.authorityName}
            <span className="faint"> · stated in the record, not verified</span>
          </dd>
        </div>
        <div>
          <dt>Uploaded by</dt>
          <dd>
            <span className="mono">{shortHex(r.creator)}</span>
            {label ? <span className="faint"> · {label}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{sourceStatus(r)}</dd>
        </div>
        <div>
          <dt>Reviews</dt>
          <dd>
            {reviews.length === 0
              ? "Open the record to load reviews"
              : reviews.map((v) => (
                  <span key={v.key} style={{ display: "block" }}>
                    {v.status === "disputed" ? "Disputed" : "Source compared"} by <span className="mono">{shortHex(v.creator)}</span>
                    {walletLabel(v.creator) ? <span className="faint"> · {walletLabel(v.creator)}</span> : null}
                  </span>
                ))}
          </dd>
        </div>
        <div>
          <dt>Filed</dt>
          <dd>{formatDate(r.filedMs)} (date stated in the synthetic record)</dd>
        </div>
      </dl>
    </div>
  )
}

function QuickStart() {
  const nav = useNavigate()
  const [authority, setAuthority] = useState("")
  return (
    <div className="quick">
      <span className="eyebrow">Start with a question</span>
      <div className="cluster">
        <Link className="chip" to="/archive?outcome=denied">
          Refused replies
        </Link>
        <Link className="chip" to="/archive?outcome=no-reply">
          No reply recorded
        </Link>
        <Link className="chip" to="/archive?rmin=31">
          Took more than 30 days
        </Link>
        <Link className="chip" to="/archive?section=8(1)(j)">
          Cited personal information
        </Link>
      </div>
      <form
        className="quick-form"
        onSubmit={(e) => {
          e.preventDefault()
          nav(authority ? `/archive?authority=${encodeURIComponent(authority)}` : "/archive")
        }}
      >
        <label htmlFor="quick-auth" className="visually-hidden">
          Authority
        </label>
        <select id="quick-auth" className="select" value={authority} onChange={(e) => setAuthority(e.target.value)}>
          <option value="">Any synthetic authority</option>
          {AUTHORITIES.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          Show replies <Arrow />
        </button>
      </form>
    </div>
  )
}

const FAQ: [string, string][] = [
  [
    "What is a government reply?",
    "The written answer an office sends to a formal request for information, such as a Right to Information application in India. It may supply the information, refuse it under an exemption, or transfer the request elsewhere.",
  ],
  ["Is this real government data?", "No. Every record in this demo is synthetic: invented authorities, figures and dates, clearly labelled. The storage, renewals and transactions are real, on the Arkiv Tiramisu testnet."],
  ["What does renewing storage do?", "It moves a record's expiry block later, so it stays readable for longer. Any wallet can do it for records that allow it, and it never changes the record's content."],
  [
    "Does a wallet prove a document is genuine?",
    "No. The chain shows which wallet uploaded a record and when. It cannot show that the named office issued it or that it is true. Reviews are statements by wallets, which you can weigh for yourself.",
  ],
  ["What happens at expiry?", "From its expiry block a record stops appearing in queries. Copies people already exported are unaffected, and past transactions stay in the chain's history."],
  ["Does the standalone reader need internet?", "Yes. It needs no Muniment website, but it must reach an Arkiv endpoint to read records."],
]

export default function Landing() {
  usePageMeta("Muniment", "Find government replies, save related records and help keep them available, even when the original website changes. Synthetic records on the Arkiv testnet.", { path: "/" })
  const { head } = useHead(120_000)
  const sample = useSample()
  return (
    <div className="landing">
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1 className="display hero-title">
              <span>Public answers.</span> <span className="accent">Worth keeping.</span>
            </h1>
            <p className="hero-lede">Find government replies, save related records and help keep them available, even when the original website changes.</p>
            <div className="cluster hero-actions">
              <Link to="/archive" className="btn btn-primary btn-lg">
                Explore the archive
                <Arrow />
              </Link>
              <Link to="/how-it-works#mechanism" className="link-arrow">
                How preservation works <Arrow />
              </Link>
            </div>
            <p className="hero-note">Synthetic records on Arkiv testnet. No wallet needed to browse.</p>
          </div>
          <RecordPreview state={sample} head={head} />
        </div>
      </section>

      <section className="section-block band" aria-labelledby="problem-heading">
        <div className="wrap split">
          <div className="stack">
            <span className="eyebrow">The problem</span>
            <h2 id="problem-heading" className="display section-title">A public answer should outlast a portal.</h2>
            <p className="measure">In August 2023, The Wire and National Herald, citing The Hindu, reported that records of past applications had disappeared from India's RTIOnline portal. The portal showed a maintenance notice saying archival data would be available soon, and the department running it did not respond to The Hindu's questions.</p>
            <div className="cluster">
              <ExternalLink href="https://m.thewire.in/article/government/rti-portal-rtionline-years-of-information-disappears">The Wire</ExternalLink>
              <ExternalLink href="https://www.nationalheraldindia.com/amp/story/national/rti-years-of-data-go-missing-from-the-union-governments-information-portal">National Herald</ExternalLink>
            </div>
            <p className="muted measure">This reporting describes an access failure at that time; it does not establish permanent deletion. Muniment is an independent preservation demonstration, not a replacement for the official RTI portal.</p>
          </div>
          <div className="stack">
            <span className="eyebrow">Who it is for</span>
            <h3>For people who need to cite the answer later.</h3>
            <p className="measure">Journalists tracking a story, RTI applicants keeping their replies, and civic researchers comparing public decisions need records they can find, check and share again.</p>
            <h3>Why preserve it separately?</h3>
            <p className="muted measure">A portal outage or a lost account should not be the only way to reach an important answer. Muniment stores queryable records on Arkiv, separates the claimed authority from the publishing wallet, and lets other wallets renew storage.</p>
            <h3>How it helps</h3>
            <p className="muted measure">Find a reply, inspect its provenance, save a local collection and renew the records you rely on. The standalone reader can retrieve them without this website. Storage still expires, and live reads still require a reachable Arkiv endpoint.</p>
            <p className="faint">This edition contains synthetic records and real testnet transactions. It has not imported the missing RTIOnline applications.</p>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="wrap">
          <Reveal className="section-intro">
            <span className="eyebrow">How it works</span>
            <h2 className="display section-title">Find it. Save it. Renew it.</h2>
          </Reveal>
          <ol className="steps">
            <li>
              <span className="step-n">1</span>
              <h3>Find a reply</h3>
              <p className="muted">Filter by authority, topic, outcome or how long the answer took.</p>
            </li>
            <li>
              <span className="step-n">2</span>
              <h3>Save to a collection</h3>
              <p className="muted">Group related replies in this browser and export them. Saving is a local bookmark; it costs nothing and changes nothing on chain.</p>
            </li>
            <li>
              <span className="step-n">3</span>
              <h3>Renew storage</h3>
              <p className="muted">Pay a small testnet fee to keep chosen records readable for longer. Of these three steps, only renewing writes to Arkiv. Publishing a new synthetic record also requires a transaction.</p>
            </li>
          </ol>
          <QuickStart />
        </div>
      </section>

      <section className="section-block band">
        <div className="wrap split">
          <Reveal className="stack">
            <span className="eyebrow">Preserve</span>
            <h2 className="section-title display">Preserve the records you rely on.</h2>
            <p className="measure lede-sm">Anyone can add storage time without changing the reply.</p>
            <p className="muted measure">
              Each record has an expiry block. Renewing moves it later and leaves a public receipt that anyone can check against the transaction. Most demo
              records are sealed, so not even their publisher can delete them; two are deliberately left publisher-held, and each record page says which it is.
            </p>
            <Link to="/preserve" className="link-arrow">
              Open the preserve queue <Arrow />
            </Link>
          </Reveal>
          <Reveal>
            <PreservePanel head={head} />
          </Reveal>
        </div>
      </section>

      <section className="section-block">
        <div className="wrap split">
          <Reveal className="stack">
            <span className="eyebrow">Provenance</span>
            <h2 className="section-title display">Know where a reply came from.</h2>
            <p className="measure lede-sm">See who uploaded it, the claimed source and any reviews.</p>
            <p className="muted measure">Preserving a record does not prove a government office issued it. Every record shows its source status, and disputes stay visible.</p>
            <Link to="/how-it-works#provenance" className="link-arrow">
              How provenance works <Arrow />
            </Link>
          </Reveal>
          <Reveal>
            <ProvenancePanel sample={sample} />
          </Reveal>
        </div>
      </section>

      <section className="section-block band">
        <div className="wrap split">
          <Reveal className="stack">
            <span className="eyebrow">Independent reader</span>
            <h2 className="section-title display">Read it without our website.</h2>
            <p className="muted measure">
              The standalone reader is a single HTML file. Save it, open it in a browser, and it searches the same records straight from Arkiv. It doesn't use
              this website at all, but it does need an internet connection to an Arkiv endpoint.
            </p>
            <div className="cluster">
              <a href="/reader.html" className="btn">
                Open the reader
              </a>
              <a href="/reader.html" download="muniment-reader.html" className="link-arrow">
                Download reader.html <Arrow dir="down" />
              </a>
            </div>
          </Reveal>
          <Reveal>
            <div className="flat-panel">
              <div className="flat-panel-head">
                <span className="eyebrow">What the reader needs</span>
              </div>
              <ul className="need-list">
                <li>
                  <strong>A browser</strong>
                  <span className="muted">Opened from disk or served from any static host.</span>
                </li>
                <li>
                  <strong>An Arkiv endpoint</strong>
                  <span className="muted">The public Tiramisu RPC by default; you can enter another.</span>
                </li>
                <li>
                  <strong>Not needed</strong>
                  <span className="muted">This website, a Muniment server, an account, a wallet or any CDN.</span>
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-block">
        <div className="wrap">
          <Reveal className="section-intro">
            <span className="eyebrow">For research, and for reuse</span>
            <h2 className="display section-title">Built to be cited and reused.</h2>
          </Reveal>
          <div className="uses">
            <div className="use">
              <h3>A reporter's citation bundle</h3>
              <p className="muted">Save the replies behind a story into a collection, renew the ones that matter, and export a JSON bundle with every record key and when you last checked it.</p>
              <Link to="/collections" className="link-arrow">
                Start a collection <Arrow />
              </Link>
            </div>
            <div className="use">
              <h3>A separate dashboard on the same data</h3>
              <p className="muted">Response times and refusals by authority, computed by a different app on a different site from the public data contract.</p>
              <ExternalLink href={DASHBOARD_URL} className="link-arrow">
                Open the dashboard <Arrow dir="ne" />
              </ExternalLink>
            </div>
          </div>
          <p className="faint" style={{ marginTop: "var(--space-5)" }}>
            Building something? The <Link to="/developers">developer page</Link> has the data contract, exact queries and the query package.
          </p>
        </div>
      </section>

      <section className="section-block band">
        <div className="wrap faq-grid">
          <div>
            <span className="eyebrow">Questions</span>
            <h2 className="display section-title">Plain answers.</h2>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q} className="faq-item">
                <summary>{q}</summary>
                <p className="muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="closing">
        <div className="wrap closing-inner">
          <h2 className="display closing-title">Find a reply worth keeping.</h2>
          <p className="closing-text">Browsing is free and needs no wallet. Renewing storage uses free test GLM on the Arkiv testnet.</p>
          <Link to="/archive" className="btn btn-ink btn-lg">
            Explore the archive <Arrow />
          </Link>
        </div>
      </section>
    </div>
  )
}
