import { type DerivedStatus, type Hex, OUTCOME_LABELS, type Reply, elapsedDays } from "muniment-query"
import { useState } from "react"
import { Link } from "react-router"
import { addToCollection, collectionsStore, createCollection } from "../lib/collections"
import { TRUSTED_PUBLISHERS } from "../lib/config"
import { type HeadAnchor, blockToMs, blocksToDuration, formatDate, formatDateTime, sameAddress } from "../lib/format"
import { Dialog, Notice } from "./ui"

export function isTrustedPublisher(addr: string | null) {
  return TRUSTED_PUBLISHERS.some((t) => sameAddress(t, addr))
}

export function StatusPill({ status }: { status: DerivedStatus }) {
  const map: Record<DerivedStatus, [string, string]> = {
    unreviewed: ["pill", "Not reviewed"],
    "source-compared": ["pill pill-ok", "Source compared"],
    disputed: ["pill pill-danger", "Disputed"],
    superseded: ["pill pill-warn", "Superseded by correction"],
  }
  const [cls, text] = map[status]
  return <span className={cls}>{text}</span>
}

export function OutcomePill({ reply }: { reply: Reply }) {
  const tone = { granted: "pill-ok", partial: "pill-warn", denied: "pill-danger", transferred: "pill-info", "no-reply": "" }[reply.outcome]
  return <span className={`pill ${tone}`}>{OUTCOME_LABELS[reply.outcome]}</span>
}

export function ExpiryText({ expiresAt, head }: { expiresAt: bigint | null; head: HeadAnchor | null }) {
  if (expiresAt === null) return <span className="faint">Expiry unknown</span>
  if (!head) return <span className="mono">block {expiresAt.toLocaleString("en-GB")}</span>
  const left = expiresAt - head.block
  if (left <= 0n) return <span className="pill pill-danger">Past expiry block</span>
  const days = Number(left) / 43_200
  const cls = days < 14 ? "pill-danger" : days < 45 ? "pill-warn" : "pill-ok"
  return (
    <span className={`pill ${cls} no-dot`} title={`Expiry block ${expiresAt.toLocaleString("en-GB")}, about ${formatDateTime(blockToMs(expiresAt, head))}`}>
      ≈ {blocksToDuration(left)} left
    </span>
  )
}

export function ResponseText({ reply, nowMs }: { reply: Reply; nowMs: number }) {
  if (reply.outcome === "no-reply") {
    return <span>No reply recorded · waiting {elapsedDays(reply.filedMs, nowMs)} days since filing</span>
  }
  if (reply.responseDays === null) return <span className="faint">Response time not recorded</span>
  return (
    <span>
      Replied in {reply.responseDays} days
      {reply.responseDays > 30 ? <span className="faint"> (over 30 days; exceptions may apply)</span> : null}
    </span>
  )
}

export function ReplyRow({ reply, head, nowMs }: { reply: Reply; head: HeadAnchor | null; nowMs: number }) {
  const trusted = isTrustedPublisher(reply.creator)
  return (
    <article className="reply-row">
      <div className="reply-row-main">
        <div className="cluster" style={{ marginBottom: "0.4rem" }}>
          <OutcomePill reply={reply} />
          {reply.exemption ? <span className="pill no-dot mono">§ {reply.exemption}</span> : null}
          {reply.corrects ? <span className="pill pill-warn no-dot">Correction</span> : null}
          {!trusted ? <span className="pill pill-danger no-dot">Untrusted publisher</span> : null}
        </div>
        <h3>
          <Link to={`/records/${reply.key}`}>{reply.payload.title}</Link>
        </h3>
        <p className="muted reply-row-meta">
          {reply.payload.authorityName} · filed {formatDate(reply.filedMs)} · <ResponseText reply={reply} nowMs={nowMs} />
        </p>
      </div>
      <div className="reply-row-side">
        <ExpiryText expiresAt={reply.expiresAtBlock} head={head} />
        <SaveButton reply={reply} head={head} />
      </div>
    </article>
  )
}

export function SaveButton({ reply, head, label = "Save to collection" }: { reply: Reply; head: HeadAnchor | null; label?: string }) {
  const all = collectionsStore.use()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [msg, setMsg] = useState<string | null>(null)
  const inAny = all.filter((c) => c.items.some((i) => i.key === reply.key))
  const observation = head
    ? {
        observedAtBlock: head.block.toString(),
        observedAtMs: head.timeMs,
        expiresAtBlock: reply.expiresAtBlock?.toString() ?? null,
        creator: reply.creator,
        title: reply.payload.title,
        authority: reply.payload.authorityName,
      }
    : null
  const add = (id: string) => {
    const r = addToCollection(id, reply.key as Hex, observation)
    setMsg(r === "added" ? "Saved to collection." : "Already in that collection; observation refreshed.")
  }
  return (
    <>
      <button type="button" className="btn btn-sm" onClick={() => { setMsg(null); setOpen(true) }} aria-haspopup="dialog">
        {inAny.length ? `Saved in ${inAny.length} collection${inAny.length === 1 ? "" : "s"}` : label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Save to a collection">
        <p className="muted">
          Collections live only in this browser. Clearing site data deletes them, so export a copy from the Collections page. Nothing is sent to
          Arkiv or to Muniment.
        </p>
        {all.length > 0 ? (
          <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {all.map((c) => {
              const has = c.items.some((i) => i.key === reply.key)
              return (
                <li key={c.id} className="cluster" style={{ justifyContent: "space-between" }}>
                  <span>
                    {c.name} <span className="faint">({c.items.length})</span>
                  </span>
                  <button type="button" className="btn btn-sm" onClick={() => add(c.id)}>
                    {has ? "Saved · refresh" : "Add"}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="faint">You have no collections yet.</p>
        )}
        <form
          className="cluster"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            const c = createCollection(name)
            add(c.id)
            setName("")
          }}
        >
          <div className="field" style={{ flex: "1 1 14rem" }}>
            <label htmlFor={`new-col-${reply.key.slice(2, 10)}`}>New collection</label>
            <input id={`new-col-${reply.key.slice(2, 10)}`} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Ward 4 road spending" />
          </div>
          <button type="submit" className="btn" style={{ alignSelf: "end" }} disabled={!name.trim()}>
            Create and save
          </button>
        </form>
        {msg ? (
          <div aria-live="polite">
            <Notice tone="ok">{msg}</Notice>
          </div>
        ) : null}
      </Dialog>
    </>
  )
}
