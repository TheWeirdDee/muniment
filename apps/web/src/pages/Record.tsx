import {
  type Hex,
  type Linked,
  type LookupResult,
  type Receipt,
  type Reply,
  SEAL_ADDRESS,
  type VerificationState,
  countVerifiedWallets,
  deriveStatus,
  explorerEntity,
  explorerTx,
  findCreationTx,
  isEntityKey,
  verifyRenewalReceipt,
  clearReadCache,
} from "muniment-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { ExpiryText, OutcomePill, ResponseText, SaveButton, StatusPill, isTrustedPublisher } from "../components/RecordBits"
import { RenewDialog } from "../components/RenewDialog"
import { Address, CopyButton, ExternalLink, Notice, Skeleton, SyntheticPill } from "../components/ui"
import { useAnnounce } from "../lib/announce"
import { publicClient, readErrorMessage, reader } from "../lib/arkiv"
import { collectionsStore } from "../lib/collections"
import { TRUSTED_REVIEWERS } from "../lib/config"
import { blockToMs, formatBlock, formatDate, formatDateTime, plural, sameAddress, shortHex } from "../lib/format"
import { useHead } from "../lib/hooks"
import { useEntityEvents } from "../lib/live"
import { usePageMeta } from "../lib/meta"

type Load = { state: "loading" } | { state: "error"; msg: string } | { state: "done"; result: LookupResult<Reply> }

export default function Record() {
  const { key: rawKey = "" } = useParams()
  const key = rawKey.toLowerCase()
  const [load, setLoad] = useState<Load>({ state: "loading" })
  const [linked, setLinked] = useState<Linked | null>(null)
  const [linkedError, setLinkedError] = useState<string | null>(null)
  const [refreshNote, setRefreshNote] = useState<string | null>(null)
  const { head } = useHead()
  const announce = useAnnounce()
  const reply = load.state === "done" && load.result.state === "found" ? load.result.record : null

  usePageMeta(reply ? reply.payload.title : "Record", reply ? `Synthetic record: ${reply.payload.title}. Claimed issuer, on-chain publisher, review status and expiry, read from Arkiv.` : "A synthetic Muniment record read live from Arkiv.", {
    path: `/records/${key}`,
    noindex: true,
  })

  const fetchAll = useCallback(
    async (reason?: string) => {
      if (!isEntityKey(key)) {
        setLoad({ state: "done", result: { state: "invalid-key" } })
        return
      }
      try {
        if (reason) clearReadCache()
        const r = reader()
        const result = await r.getReply(key)
        setLoad({ state: "done", result })
        if (result.state === "found") {
          try {
            setLinked(await r.getLinked(result.record.key))
            setLinkedError(null)
          } catch (e) {
            setLinkedError(readErrorMessage(e))
          }
        }
        if (reason) {
          setRefreshNote(`Updated after ${reason} at ${new Date().toLocaleTimeString("en-GB")}.`)
          if (reason.includes("event")) announce("This record changed on Arkiv and was refreshed.")
        }
      } catch (e) {
        setLoad((prev) => (prev.state === "done" ? prev : { state: "error", msg: readErrorMessage(e) }))
        if (reason) setRefreshNote(`A refresh failed: ${readErrorMessage(e)}`)
      }
    },
    [key, announce],
  )

  useEffect(() => {
    setLoad({ state: "loading" })
    setLinked(null)
    fetchAll()
  }, [fetchAll])

  const watchKeys = useMemo(() => (reply ? [reply.key, ...(linked?.appeals.map((a) => a.key) ?? [])] : []), [reply, linked])
  const live = useEntityEvents(watchKeys, (why) => fetchAll(why))

  if (load.state === "loading") {
    return (
      <div className="wrap" style={{ paddingBlock: "var(--space-8)" }} aria-busy="true">
        <Skeleton lines={6} />
      </div>
    )
  }
  if (load.state === "error") {
    return (
      <StatePage title="Arkiv could not be reached" tone="danger">
        <p>{load.msg}</p>
        <p>The record may still exist; this is a read failure, not evidence that it is gone.</p>
        <button type="button" className="btn" onClick={() => fetchAll()}>
          Try again
        </button>
      </StatePage>
    )
  }
  const res = load.result
  if (res.state === "invalid-key") {
    return (
      <StatePage title="That is not a record key" tone="warn">
        <p>Record links end in a 32-byte entity key: 0x followed by 64 hexadecimal characters.</p>
      </StatePage>
    )
  }
  if (res.state === "missing") return <MissingRecord k={key as Hex} head={head} block={res.blockNumber} />
  if (res.state === "unsupported") {
    return (
      <StatePage title="Unsupported schema version" tone="warn">
        <p>This entity uses Muniment's namespace with a schema version this site does not understand. It is not shown as a record.</p>
        <ExternalLink href={explorerEntity(key)}>Inspect it in the explorer</ExternalLink>
      </StatePage>
    )
  }
  if (res.state === "malformed") {
    return (
      <StatePage title="Malformed record" tone="danger">
        <p>This entity claims Muniment's namespace but fails the data contract: {res.reason}.</p>
        <p>Muniment does not display entities it cannot validate. Anyone can write entities that look like Muniment records.</p>
        <ExternalLink href={explorerEntity(key)}>Inspect it in the explorer</ExternalLink>
      </StatePage>
    )
  }
  return <RecordView reply={res.record} linked={linked} linkedError={linkedError} head={head} live={live} refreshNote={refreshNote} onRefresh={() => fetchAll("your request")} />
}

function StatePage({ title, tone, children }: { title: string; tone: "warn" | "danger"; children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ paddingBlock: "var(--space-8)", maxWidth: "48rem" }}>
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link to="/archive">Archive</Link> / <span>Record</span>
      </nav>
      <h1 style={{ fontSize: "var(--step-4)", margin: "var(--space-4) 0" }}>{title}</h1>
      <div className={`notice notice-${tone} stack-sm`}>{children}</div>
    </div>
  )
}

function MissingRecord({ k, head, block }: { k: Hex; head: ReturnType<typeof useHead>["head"]; block: bigint }) {
  const all = collectionsStore.use()
  const obs = all.flatMap((c) => c.items.filter((i) => i.key === k).map((i) => ({ c: c.name, o: i.observation }))).find((x) => x.o)
  const exp = obs?.o?.expiresAtBlock ? BigInt(obs.o.expiresAtBlock) : null
  const evidencedExpiry = exp !== null && exp <= block
  return (
    <StatePage title={evidencedExpiry ? "This record has most likely expired" : "Record not found on Arkiv"} tone="warn">
      {evidencedExpiry ? (
        <p>
          Your collection "{obs?.c}" observed this record on {formatDateTime(obs?.o?.observedAtMs ?? 0)} with expiry block {formatBlock(exp)}. Arkiv is now
          at block {formatBlock(block)}, past that expiry, and returns nothing for this key. That is consistent with expiry; Muniment cannot prove it
          was not deleted earlier.
        </p>
      ) : (
        <p>
          Arkiv returned no live entity for this key at block {formatBlock(block)}. It may have expired, been deleted by its owner, or never existed.
          Absence alone does not show which.
        </p>
      )}
      <p>Copies already exported, and the original transactions in the explorer, are not affected by expiry.</p>
      <div className="cluster">
        <ExternalLink href={explorerEntity(k)}>Look up this key in the explorer</ExternalLink>
        <Link to="/archive">Back to the archive</Link>
      </div>
    </StatePage>
  )
}

function RecordView({
  reply,
  linked,
  linkedError,
  head,
  live,
  refreshNote,
  onRefresh,
}: {
  reply: Reply
  linked: Linked | null
  linkedError: string | null
  head: ReturnType<typeof useHead>["head"]
  live: ReturnType<typeof useEntityEvents>
  refreshNote: string | null
  onRefresh: () => void
}) {
  const [renewOpen, setRenewOpen] = useState(false)
  const [creationTx, setCreationTx] = useState<Hex | null | "unknown">("unknown")
  const view = linked ? deriveStatus(reply, linked, TRUSTED_REVIEWERS) : null
  const trusted = isTrustedPublisher(reply.creator)
  const sealed = sameAddress(reply.owner, SEAL_ADDRESS)
  const nowMs = head?.timeMs ?? Date.now()
  const p = reply.payload

  useEffect(() => {
    if (reply.createdAtBlock === null) return
    let alive = true
    findCreationTx(publicClient() as never, reply.key, reply.createdAtBlock)
      .then((t) => alive && setCreationTx(t))
      .catch(() => alive && setCreationTx(null))
    return () => {
      alive = false
    }
  }, [reply.key, reply.createdAtBlock])

  return (
    <article>
      <header className="record-head">
        <div className="wrap">
          <nav aria-label="Breadcrumb" className="crumbs">
            <Link to="/archive">Archive</Link> / <span aria-current="page">{shortHex(reply.key, 8, 6)}</span>
          </nav>
          <div className="cluster" style={{ marginTop: "var(--space-4)" }}>
            <SyntheticPill />
            {view ? <StatusPill status={view.status} /> : <span className="pill">Checking reviews…</span>}
            <OutcomePill reply={reply} />
            {!trusted ? <span className="pill pill-danger">Publisher not trusted by this site</span> : null}
          </div>
          <h1 className="record-title">{p.title}</h1>
          <p className="record-sub">
            Claimed issuer: <strong>{p.authorityName}</strong> · {p.jurisdictionName} · ref <span className="mono">{reply.reference}</span>
          </p>
        </div>
      </header>

      <div className="wrap record-layout">
        <div className="record-main stack">
          {view?.status === "superseded" && view.supersededBy ? (
            <Notice tone="warn" title="The publisher has issued a correction">
              <Link to={`/records/${view.supersededBy.key}`}>Read the corrected record</Link>. This original stays unchanged on Arkiv. Reason given:{" "}
              {view.supersededBy.payload.correction?.reason}
            </Notice>
          ) : null}
          {reply.corrects ? (
            <Notice tone="info" title="This record is a correction">
              It restates <Link to={`/records/${reply.corrects}`}>an earlier record</Link>, which remains readable. Reason: {p.correction?.reason}
            </Notice>
          ) : null}
          {view?.status === "disputed" ? (
            <Notice tone="danger" title="A reviewer you trust disputes this record">
              See the review below for what was compared and its limits. The record itself is unchanged.
            </Notice>
          ) : null}

          <section className="doc-sheet" aria-labelledby="q-h">
            <div className="doc-meta">
              <span>Filed {formatDate(reply.filedMs)}</span>
              <span>{reply.repliedMs ? `Replied ${formatDate(reply.repliedMs)}` : "No reply recorded"}</span>
              <span>
                <ResponseText reply={reply} nowMs={nowMs} />
              </span>
            </div>
            <h2 id="q-h" className="doc-label">
              Question asked
            </h2>
            <p className="doc-text">{p.question}</p>
            <h2 className="doc-label">Reply</h2>
            {p.answer ? <p className="doc-text">{p.answer}</p> : <p className="doc-text faint">No reply text. The authority did not answer, according to this record.</p>}
            {p.exemptions.length ? (
              <p className="doc-foot">
                Exemption sections cited: {p.exemptions.map((s) => <span key={s} className="mono">§ {s} </span>)}
              </p>
            ) : null}
            <p className="doc-foot">{p.disclosure}</p>
          </section>

          <section aria-labelledby="prov-h" className="panel">
            <div className="panel-head">
              <h2 id="prov-h" style={{ fontSize: "var(--step-1)" }}>
                Provenance
              </h2>
              <span className="faint" style={{ fontSize: "0.85rem" }}>
                What Arkiv can show, and what it cannot
              </span>
            </div>
            <div className="panel-body stack">
              <dl className="kv">
                <dt>Claimed issuing authority</dt>
                <dd>
                  {p.authorityName} <span className="faint">(stated in the record; not verified by Arkiv)</span>
                </dd>
                <dt>Published by (on-chain creator)</dt>
                <dd>
                  <Address value={reply.creator} />
                  <div className="faint" style={{ fontSize: "0.85rem" }}>
                    {trusted ? "A publisher this site trusts by default. Trust is a choice, not a certificate." : "Not a publisher this site trusts. Treat with extra care."}
                  </div>
                </dd>
                <dt>Published at</dt>
                <dd>
                  block {formatBlock(reply.createdAtBlock)}
                  {head && reply.createdAtBlock ? <span className="faint"> (≈ {formatDateTime(blockToMs(reply.createdAtBlock, head))})</span> : null}
                </dd>
                <dt>Creation transaction</dt>
                <dd>
                  {creationTx === "unknown" ? (
                    <span className="faint">Looking up…</span>
                  ) : creationTx ? (
                    <ExternalLink href={explorerTx(creationTx)} className="hash">
                      {shortHex(creationTx, 10, 8)}
                    </ExternalLink>
                  ) : (
                    <span className="faint">Not served by this endpoint</span>
                  )}
                </dd>
                <dt>Content changes</dt>
                <dd>{reply.readonly ? "Frozen: created read-only, so nobody can edit it" : "Editable by its owner"}</dd>
                <dt>Deletion</dt>
                <dd>
                  {sealed
                    ? "Sealed: ownership was sent to 0x…dEaD, a conventional burn address assumed to have no usable key. While that holds, no wallet can delete or transfer it. It can still expire."
                    : "Publisher-held: the owner wallet can still delete or transfer this record."}
                </dd>
                <dt>Claimed source</dt>
                <dd>
                  <span className="mono">{p.claimedSource.reference}</span>
                  {p.claimedSource.documentDate ? <> · dated {formatDate(Date.parse(`${p.claimedSource.documentDate}T00:00:00Z`))}</> : null}
                  <div className="faint" style={{ fontSize: "0.85rem" }}>
                    {p.claimedSource.url ? (
                      <>
                        Points to <ExternalLink href={p.claimedSource.url}>a synthetic fixture file</ExternalLink>. External links are not preserved by Arkiv and may
                        change or disappear.
                      </>
                    ) : (
                      "Synthetic record: there is no live source to compare against."
                    )}
                  </div>
                </dd>
              </dl>
              <p className="faint" style={{ fontSize: "0.88rem" }}>
                Preservation proves what was submitted, by which wallet and when. It does not prove that the named authority issued this document or that
                its contents are true.
              </p>
            </div>
          </section>

          <ReviewsSection linked={linked} linkedError={linkedError} />
          <AppealsSection linked={linked} />
        </div>

        <aside className="record-side stack" aria-label="Preservation">
          <section className="panel">
            <div className="panel-head">
              <h2 style={{ fontSize: "var(--step-1)" }}>Preservation</h2>
              <span className={`pill no-dot ${live === "live" ? "pill-ok" : live === "fallback" ? "pill-warn" : ""}`}>
                {live === "live" ? "Live updates" : live === "fallback" ? "Rechecking every 30 s" : "Connecting…"}
              </span>
            </div>
            <div className="panel-body stack">
              <dl className="kv">
                <dt>Expires at block</dt>
                <dd className="mono">{formatBlock(reply.expiresAtBlock)}</dd>
                <dt>Approximately</dt>
                <dd>{head && reply.expiresAtBlock ? formatDateTime(blockToMs(reply.expiresAtBlock, head)) : "…"}</dd>
                <dt>Time left</dt>
                <dd>
                  <ExpiryText expiresAt={reply.expiresAtBlock} head={head} />
                </dd>
                <dt>Who can renew</dt>
                <dd>{reply.permissionlessExtension ? "Any wallet (permissionless extension)" : "Only the owner wallet"}</dd>
              </dl>
              <div className="cluster">
                <button type="button" className="btn btn-primary" onClick={() => setRenewOpen(true)}>
                  Renew storage
                </button>
                <SaveButton reply={reply} head={head} />
              </div>
              <p className="faint" style={{ fontSize: "0.82rem" }}>
                Block-to-date conversions assume 2-second blocks and are approximate. {refreshNote}
              </p>
              <button type="button" className="btn btn-sm" onClick={onRefresh}>
                Re-read from Arkiv
              </button>
            </div>
          </section>
          <RenewalsSection linked={linked} />
          <EvidencePanel reply={reply} creationTx={creationTx === "unknown" ? null : creationTx} />
        </aside>
      </div>
      <RenewDialog open={renewOpen} onClose={() => setRenewOpen(false)} keys={[reply.key]} onDone={onRefresh} />
    </article>
  )
}

function ReviewsSection({ linked, linkedError }: { linked: Linked | null; linkedError: string | null }) {
  if (linkedError) return <Notice tone="warn" title="Linked records could not be loaded">{linkedError}</Notice>
  if (!linked) return <Skeleton lines={2} />
  const reviews = [...linked.reviews].sort((a, b) => Number((b.createdAtBlock ?? 0n) - (a.createdAtBlock ?? 0n)))
  return (
    <section className="panel" aria-labelledby="rev-h">
      <div className="panel-head">
        <h2 id="rev-h" style={{ fontSize: "var(--step-1)" }}>
          Reviews
        </h2>
        <span className="faint" style={{ fontSize: "0.85rem" }}>
          Statements by wallets, not certificates
        </span>
      </div>
      <div className="panel-body stack">
        {reviews.length === 0 ? <p className="faint">No review has been published for this record. "Not reviewed" says nothing about its accuracy.</p> : null}
        {reviews.map((r) => {
          const trusted = TRUSTED_REVIEWERS.some((t) => sameAddress(t, r.creator))
          return (
            <div key={r.key} className="review">
              <div className="cluster">
                <span className={`pill ${r.status === "disputed" ? "pill-danger" : "pill-ok"}`}>{r.status === "disputed" ? "Disputed" : "Source compared"}</span>
                <span>
                  by <Address value={r.creator} />
                </span>
                {!trusted ? <span className="pill pill-warn no-dot">Reviewer not trusted by this site · not counted</span> : null}
              </div>
              <p>
                <strong>Method:</strong> {r.payload.method}
              </p>
              <p className="muted">
                <strong>Limits:</strong> {r.payload.limitations}
              </p>
              <p className="faint" style={{ fontSize: "0.85rem" }}>
                Observed {r.payload.observedAt}
                {r.payload.evidenceRef ? (
                  <>
                    {" "}
                    · <ExternalLink href={r.payload.evidenceRef.startsWith("https://") ? r.payload.evidenceRef : "#"}>evidence reference</ExternalLink>
                  </>
                ) : null}
              </p>
            </div>
          )
        })}
        {linked.corrections.length > 0 ? (
          <div className="stack-sm">
            <h3 style={{ fontSize: "var(--step-0)" }}>Corrections linked to this record</h3>
            <ul>
              {linked.corrections.map((c) => (
                <li key={c.key}>
                  <Link to={`/records/${c.key}`}>{c.payload.title}</Link> by <Address value={c.creator} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function AppealsSection({ linked }: { linked: Linked | null }) {
  if (!linked) return null
  if (linked.appeals.length === 0 && linked.exemptions.length === 0) return null
  return (
    <section className="panel" aria-labelledby="app-h">
      <div className="panel-head">
        <h2 id="app-h" style={{ fontSize: "var(--step-1)" }}>
          Appeals and exemption notes
        </h2>
        <span className="faint" style={{ fontSize: "0.85rem" }}>
          Linked records renew together
        </span>
      </div>
      <div className="panel-body stack">
        {linked.appeals
          .sort((a, b) => a.filedMs - b.filedMs)
          .map((a) => (
            <div key={a.key} className="review">
              <div className="cluster">
                <span className="pill pill-info no-dot">{a.stage === "first-appeal" ? "First appeal" : "Second appeal"}</span>
                <span className="pill no-dot">{a.outcome}</span>
                <span className="faint">filed {formatDate(a.filedMs)}</span>
              </div>
              <p>{a.payload.grounds}</p>
              {a.payload.decision ? <p className="muted">Decision: {a.payload.decision}</p> : null}
              <p className="faint" style={{ fontSize: "0.82rem" }}>
                Expires at block {formatBlock(a.expiresAtBlock)} · {a.permissionlessExtension ? "anyone can renew" : "owner-only renewal"}
              </p>
            </div>
          ))}
        {linked.exemptions.length > 0 ? (
          <p className="muted">
            Exemption relation records: {linked.exemptions.map((x) => <span key={x.key} className="mono">§ {x.section} </span>)}{" "}
            <span className="faint">(one per cited section, so every section is searchable)</span>
          </p>
        ) : null}
        {!linked.complete ? <Notice tone="warn">Some linked lists exceeded a bounded read and may be incomplete.</Notice> : null}
      </div>
    </section>
  )
}

function RenewalsSection({ linked }: { linked: Linked | null }) {
  const [results, setResults] = useState<Record<string, VerificationState>>({})
  const receipts: Receipt[] = linked?.receipts ?? []
  useEffect(() => {
    let alive = true
    for (const r of receipts) {
      if (results[r.key]) continue
      verifyRenewalReceipt(publicClient() as never, r).then((v) => alive && setResults((prev) => ({ ...prev, [r.key]: v })))
    }
    return () => {
      alive = false
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: verify each receipt once
  }, [receipts.map((r) => r.key).join()])
  if (!linked) return null
  const verified = countVerifiedWallets(Object.values(results))
  const pending = receipts.filter((r) => !results[r.key]).length
  return (
    <section className="panel" aria-labelledby="ren-h">
      <div className="panel-head">
        <h2 id="ren-h" style={{ fontSize: "var(--step-1)" }}>
          Renewals
        </h2>
      </div>
      <div className="panel-body stack-sm">
        {receipts.length === 0 ? (
          <p className="faint">No renewal observed. Receipts that have expired are no longer queryable, so this list only covers live receipts.</p>
        ) : (
          <>
            <p>
              <strong>{plural(verified, "verified renewing wallet")}</strong>
              <span className="faint"> · wallets, not people · live receipts only{pending ? ` · checking ${pending}` : ""}</span>
            </p>
            <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {receipts.map((r) => {
                const v = results[r.key]
                return (
                  <li key={r.key} className="renewal-item">
                    <span className={`pill no-dot ${v?.state === "verified" ? "pill-ok" : v?.state === "unverified" ? "pill-danger" : ""}`}>
                      {v ? (v.state === "verified" ? "Verified" : v.state === "unverified" ? "Claim, unverified" : "Unknown") : "Checking"}
                    </span>{" "}
                    <Address value={r.creator} /> → block {formatBlock(r.targetExpiry)}
                    {v && v.state !== "verified" ? <div className="faint" style={{ fontSize: "0.8rem" }}>{v.reason}</div> : null}
                    {v?.state === "verified" ? (
                      <div style={{ fontSize: "0.8rem" }}>
                        <ExternalLink href={explorerTx(v.txHash)} className="hash">
                          {shortHex(v.txHash, 10, 8)}
                        </ExternalLink>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <p className="faint" style={{ fontSize: "0.8rem" }}>
              Verified means the same successful transaction created the receipt and extended this record to the stated block, sent by the receipt's
              creator. Anything else is shown as an unverified claim and not counted.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function EvidencePanel({ reply, creationTx }: { reply: Reply; creationTx: Hex | null }) {
  const json = JSON.stringify(
    {
      key: reply.key,
      creator: reply.creator,
      owner: reply.owner,
      createdAtBlock: reply.createdAtBlock?.toString(),
      expiresAtBlock: reply.expiresAtBlock?.toString(),
      flags: { readonly: reply.readonly, permissionlessExtension: reply.permissionlessExtension },
      attributes: {
        authority: reply.authority,
        jurisdiction: reply.jurisdiction,
        topic: reply.topic,
        outcome: reply.outcome,
        filed_ms: reply.filedMs,
        replied_ms: reply.repliedMs,
        response_days: reply.responseDays,
        exemption: reply.exemption,
        ref: reply.reference,
        corrects: reply.corrects,
      },
      payload: reply.payload,
    },
    null,
    2,
  )
  return (
    <details className="disclosure">
      <summary>Chain evidence</summary>
      <div className="disclosure-body stack-sm">
        <dl className="kv">
          <dt>Entity key</dt>
          <dd className="hash">{reply.key}</dd>
          <dt>Network</dt>
          <dd>Arkiv Tiramisu testnet (7738577)</dd>
          <dt>Schema</dt>
          <dd className="mono">muniment-archive v1</dd>
        </dl>
        <div className="cluster">
          <CopyButton value={reply.key} label="Copy key" />
          <ExternalLink href={explorerEntity(reply.key)} className="btn btn-sm">
            Explorer
          </ExternalLink>
          {creationTx ? (
            <ExternalLink href={explorerTx(creationTx)} className="btn btn-sm">
              Creation tx
            </ExternalLink>
          ) : null}
          <a href={`/reader.html#key=${reply.key}`} className="btn btn-sm">
            Open in standalone reader
          </a>
        </div>
        <pre className="code-block" style={{ maxHeight: "22rem" }} tabIndex={0} aria-label="Entity as decoded">
          {json}
        </pre>
      </div>
    </details>
  )
}
