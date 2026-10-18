import { ExpirationTime, jsonToPayload, type ExecuteBatchParameters } from "@arkiv-network/sdk"
import { i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import { APP, type Hex, OUTCOMES, OUTCOME_LABELS, type Outcome, SCHEMA_VERSION, SEAL_ADDRESS, TIRAMISU, clearReadCache, explorerTx, formatGlm, utcDay, type CostEstimate } from "muniment-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { ExternalLink, Notice } from "../components/ui"
import { useAnnounce } from "../lib/announce"
import { publicClient, readErrorMessage } from "../lib/arkiv"
import { shortHex } from "../lib/format"
import { usePageMeta } from "../lib/meta"
import { scrub } from "../lib/scrub"
import { AUTHORITIES, SECTIONS, TOPICS } from "../lib/vocab"
import { describeWalletError, useWallet } from "../lib/wallet"

import { publicationQuote } from "../lib/publication-quote"
import { submittedResult } from "../lib/transaction"
import { readTransaction, saveTransaction } from "../lib/transaction-storage"

const JUR: Record<string, { slug: string; name: string }> = {
  "ravipur-mc": { slug: "sundarvan", name: "Sundarvan (fictional state)" },
  "sundarvan-pwd": { slug: "sundarvan", name: "Sundarvan (fictional state)" },
  "kestrel-dp": { slug: "sundarvan", name: "Sundarvan (fictional state)" },
  "harbourline-ua": { slug: "meridia", name: "Meridia (fictional territory)" },
  "meridia-rrc": { slug: "meridia", name: "Meridia (fictional territory)" },
}

const QUESTIONS: Record<string, string> = {
  roads: "Please provide the sanctioned budget, the amount spent and the list of work orders for road resurfacing in the area for the financial year.",
  drainage: "Please provide the estimates, tender documents and completion certificates for storm-water drain works in the area for the financial year.",
  streetlights: "Please state the number of street lights installed and repaired in the area for the financial year, the contractor responsible, and the total amount paid.",
  contracts: "Please provide the list of civil-works contracts above 50 lakh awarded in the area for the financial year and the number of bids received for each.",
  bridges: "Please provide the most recent structural inspection reports and maintenance expenditure for bridges in the area for the financial year.",
}

const ANSWER: Record<Outcome, (sections: string[]) => string | null> = {
  granted: () => "The requested figures and documents are enclosed (synthetic annexure). All amounts in this record are invented.",
  partial: (s) => `Part of the information is enclosed (synthetic). Some details are withheld under Section ${s.join(", ")}.`,
  denied: (s) => `The request cannot be met. The information is exempt under Section ${s.join(", ")}. The applicant may file a first appeal within 30 days.`,
  transferred: () => "The information is held by another public authority. The application has been transferred under Section 6(3).",
  "no-reply": () => null,
}

const LIFETIMES = [7, 30, 90, 180]
const DISCLOSURE = "Synthetic test record published from the Muniment publish page on the Arkiv Tiramisu testnet. Not a real government reply."

type Stage =
  | { s: "idle" }
  | { s: "signing" }
  | { s: "submitted"; tx: Hex }
  | { s: "unknown"; tx: Hex; msg: string }
  | { s: "confirmed"; tx: Hex; key: Hex }
  | { s: "readback-pending"; tx: Hex; key: Hex }
  | { s: "visible"; tx: Hex; key: Hex }
  | { s: "failed"; msg: string; tx?: Hex }

export default function Publish() {
  usePageMeta("Publish a synthetic record", "Publish a templated synthetic reply to Arkiv with the read-only and permissionless-extension flags, signed by your own wallet.", { path: "/publish" })
  const w = useWallet()
  const announce = useAnnounce()
  const [authority, setAuthority] = useState(AUTHORITIES[0].slug)
  const [topic, setTopic] = useState(TOPICS[0].slug)
  const [outcome, setOutcome] = useState<Outcome>("granted")
  const [filed, setFiled] = useState("2026-06-01")
  const [days, setDays] = useState("24")
  const [sections, setSections] = useState<string[]>([])
  const [suffix, setSuffix] = useState("")
  const [lifetime, setLifetime] = useState(30)
  const [seal, setSeal] = useState(true)
  const [ack, setAck] = useState(false)
  const [stage, setStage] = useState<Stage>(() => readTransaction<Stage>("muniment.publish.pending") ?? { s: "idle" })
  const [review, setReview] = useState<{ params: ExecuteBatchParameters; cost: CostEstimate; fingerprint: string; keys: Hex[]; at: number } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const running = useRef(false)
  const [refNo] = useState(() => String(Math.floor(10000 + Math.random() * 89999)))

  const hits = useMemo(() => scrub(suffix), [suffix])
  const needsSections = outcome === "denied" || outcome === "partial"
  const today = new Date().toISOString().slice(0, 10)
  const filedOk = utcDay(filed) !== null && filed >= "2025-01-01" && filed <= today
  const daysNum = Number(days)
  const daysOk = outcome === "no-reply" || (/^\d{1,3}$/.test(days) && daysNum <= 365)
  const sectionsOk = !needsSections || sections.length > 0
  const errors = [
    !filedOk && "Choose a filing date between 1 Jan 2025 and today.",
    !daysOk && "Response time must be a whole number of days from 0 to 365.",
    !sectionsOk && "A refused or partial reply must cite at least one exemption section.",
    hits.length > 0 && `The title note may contain personal information (${hits[0].kind}). Remove it before publishing synthetic data.`,
    suffix.length > 60 && "The title note is limited to 60 characters.",
  ].filter(Boolean) as string[]

  const auth = AUTHORITIES.find((a) => a.slug === authority)!
  const topicName = TOPICS.find((t) => t.slug === topic)!.name
  const filedMs = Date.parse(`${filed}T00:00:00Z`)
  const repliedMs = outcome === "no-reply" || !daysOk || !filedOk ? null : filedMs + daysNum * 86_400_000
  const effSections = needsSections ? sections : []
  const title = `${topicName}${suffix.trim() ? ` — ${suffix.trim()}` : ""} (synthetic, user-published)`
  const ref = `USR/RTI/${filed.slice(0, 4)}/${refNo}`

  const payload = {
    schema: "muniment.reply/1",
    synthetic: true,
    title,
    question: QUESTIONS[topic],
    answer: ANSWER[outcome](effSections),
    authorityName: `${auth.name} (synthetic)`,
    jurisdictionName: JUR[authority].name,
    claimedSource: { reference: ref, url: null, documentDate: repliedMs ? new Date(repliedMs).toISOString().slice(0, 10) : null, status: "synthetic-no-source" },
    attachment: null,
    exemptions: effSections,
    correction: null,
    disclosure: DISCLOSURE,
  }

  const fingerprint = JSON.stringify([authority, topic, outcome, filed, days, sections, suffix, lifetime, seal, w.address, w.chainId])
  const currentFingerprint = useRef(fingerprint)
  currentFingerprint.current = fingerprint
  useEffect(() => { setReview(null) }, [fingerprint])
  useEffect(() => {
    if ("tx" in stage && stage.tx) saveTransaction("muniment.publish.pending", stage.s === "submitted" ? { ...stage, s: "unknown", msg: "Confirmation is not yet known." } : stage)
  }, [stage])

  const prepare = async () => {
    if (running.current || !["idle", "failed"].includes(stage.s) || errors.length || !ack || !w.address || !w.onTiramisu) return
    running.current = true
    setPreparing(true)
    const reviewedFingerprint = fingerprint
    try {
      const count = 1 + effSections.length
      const pred = await publicClient().predictEntityKeys({ owner: w.address, count })
      const attrs: Record<string, unknown> = {
        app: str(APP),
        schema: i32(SCHEMA_VERSION),
        kind: str("reply"),
        synthetic: true,
        authority: str(authority),
        jurisdiction: str(JUR[authority].slug),
        topic: str(topic),
        outcome: str(outcome),
        language: str("en"),
        filed_ms: u64(filedMs),
        ref: str(ref),
      }
      if (repliedMs !== null) {
        attrs.replied_ms = u64(repliedMs)
        attrs.response_days = i32(daysNum)
      }
      if (effSections[0]) attrs.exemption = str(effSections[0])
      const creates = [
        { payload: jsonToPayload(payload), contentType: "application/json" as const, attributes: attrs as never, expires: ExpirationTime.fromDays(lifetime), flags: { readonly: true, permissionlessExtension: true }, salt: pred[0].salt },
        ...effSections.map((s, i) => ({
          payload: new Uint8Array(),
          contentType: "application/octet-stream" as never,
          attributes: { app: str(APP), schema: i32(SCHEMA_VERSION), kind: str("exemption"), reply: key(pred[0].key), section: str(s) } as never,
          expires: ExpirationTime.fromDays(lifetime),
          flags: { readonly: true, permissionlessExtension: true },
          salt: pred[i + 1].salt,
        })),
      ]
      const params = { creates, ownershipChanges: seal ? pred.map(p => ({ entityKey: p.key, newOwner: SEAL_ADDRESS })) : [] }
      const cost = await publicationQuote(params, w.address)
      if (reviewedFingerprint === currentFingerprint.current) setReview({ params, cost, fingerprint: reviewedFingerprint, keys: pred.map(p => p.key), at: Date.now() })
    } catch (err) { setStage({ s: "failed", msg: describeWalletError(err) }) }
    finally { running.current = false; setPreparing(false) }
  }

  const publish = async () => {
    if (running.current || !["idle", "failed"].includes(stage.s) || !review || review.fingerprint !== fingerprint || !w.onTiramisu || !w.address || errors.length || !ack) return
    if (Date.now() - review.at > 300000) { setReview(null); announce("Quote expired. Review a fresh estimate before signing."); return }
    running.current = true
    setStage({ s: "signing" })
    let tx: Hex | undefined
    try {
      const currentKeys = await publicClient().predictEntityKeys({ owner: w.address, salts: review.params.creates!.map(c => c.salt as bigint) })
      if (currentFingerprint.current !== review.fingerprint || currentKeys.some((p, i) => p.key !== review.keys[i])) {
        setReview(null)
        setStage({ s: "failed", msg: "The account, network or entity nonce changed. Review a fresh publication quote." })
        return
      }
      const signer = w.signer(hash => {
        tx = hash
        const pending: Stage = { s: "unknown", tx: hash, msg: "Confirmation is not yet known." }
        saveTransaction("muniment.publish.pending", pending)
        setStage({ s: "submitted", tx: hash })
      })
      const res = await signer.executeBatch(review.params)
      const newKey = res.createdEntities[0] as Hex
      setStage({ s: "confirmed", tx: res.txHash, key: newKey })
      for (let i = 0; i < 2; i++) {
        try {
          clearReadCache()
          await publicClient().getEntity(newKey)
          setStage({ s: "visible", tx: res.txHash, key: newKey })
          announce("Published and readable from Arkiv.")
          return
        } catch {
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
      setStage({ s: "readback-pending", tx: res.txHash, key: newKey })
      announce("Publication confirmed on chain. Reading it back is delayed; do not publish it again.")
    } catch (e) {
      setStage(tx ? { s: "unknown", msg: readErrorMessage(e), tx } : { s: "failed", msg: describeWalletError(e) })
      announce(tx ? "Transaction submitted; confirmation is not yet known. Recheck without signing." : "Publishing failed.")
    } finally {
      running.current = false
    }
  }

  const busy = preparing || stage.s === "signing" || stage.s === "submitted" || stage.s === "confirmed"

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Publish</span>
          <h1>Try publishing a synthetic reply.</h1>
          <p className="lede">
            Pick from controlled test templates, then sign with your own wallet on the Arkiv testnet. Everything you publish is public. Real documents,
            uploads and links are not accepted here.
          </p>
        </div>
      </section>
      <div className="wrap section publish-layout">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (review) publish(); else prepare()
          }}
          aria-describedby="publish-errors"
        >
          <fieldset className="stack" disabled={busy || stage.s === "visible" || stage.s === "readback-pending" || stage.s === "unknown"} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="two-col">
              <div className="field">
                <label htmlFor="p-auth">Synthetic authority</label>
                <select id="p-auth" className="select" value={authority} onChange={(e) => setAuthority(e.target.value)}>
                  {AUTHORITIES.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-topic">Topic</label>
                <select id="p-topic" className="select" value={topic} onChange={(e) => setTopic(e.target.value)}>
                  {TOPICS.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-outcome">Outcome</label>
                <select id="p-outcome" className="select" value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
                  {OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {OUTCOME_LABELS[o]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-filed">Stated filing date (fictional)</label>
                <input id="p-filed" className="input" type="date" min="2025-01-01" max={today} value={filed} onChange={(e) => setFiled(e.target.value)} aria-invalid={!filedOk} />
              </div>
              {outcome !== "no-reply" ? (
                <div className="field">
                  <label htmlFor="p-days">Days until reply</label>
                  <input id="p-days" className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-invalid={!daysOk} />
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="p-life">Initial lifetime</label>
                <select id="p-life" className="select" value={lifetime} onChange={(e) => setLifetime(Number(e.target.value))}>
                  {LIFETIMES.map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {needsSections ? (
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label">Exemption sections cited</legend>
                <div className="cluster">
                  {SECTIONS.map((s) => (
                    <label key={s.slug} className="check">
                      <input
                        type="checkbox"
                        checked={sections.includes(s.slug)}
                        onChange={(e) => setSections((prev) => (e.target.checked ? [...prev, s.slug] : prev.filter((x) => x !== s.slug)))}
                      />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <div className="field">
              <label htmlFor="p-suffix">Title note (optional, 60 characters)</label>
              <input id="p-suffix" className="input" value={suffix} onChange={(e) => setSuffix(e.target.value)} maxLength={80} aria-invalid={hits.length > 0} aria-describedby="p-suffix-hint" placeholder="e.g. Ward 6 test" />
              <span id="p-suffix-hint" className="hint">
                Checked in your browser for emails, phone numbers, Aadhaar- or PAN-like numbers, postal codes and addresses. That check cannot catch
                every identifying detail, so never type anything about a real person.
              </span>
            </div>
            <label className="check">
              <input type="checkbox" checked={seal} onChange={(e) => setSeal(e.target.checked)} />
              <span>
                Seal the record: send ownership to the burn address 0x…dEaD in the same transaction.
                <span className="faint" style={{ display: "block", fontSize: "0.85rem" }}>
                  Nobody is known to hold a key for that address, so in practice no wallet, including yours, can delete or transfer a sealed record. They still expire unless someone renews them. Unsealed
                  records can be deleted by your wallet.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="notice notice-info stack-sm">
            <strong>Before you sign</strong>
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }} className="muted">
              <li>Everything below becomes public on Arkiv and in the explorer. Anyone can copy it once read.</li>
              <li>The content can never be edited. A correction is a new record.</li>
              <li>It disappears from queries after its expiry block unless a wallet renews it. Deletion and expiry do not erase copies others already made.</li>
              <li>Your wallet becomes the permanent on-chain creator. This site does not trust new publishers by default, so the record is labelled as such.</li>
            </ul>
            <label className="check">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={busy} />
              <span>I understand this publishes a synthetic test record publicly.</span>
            </label>
          </div>

          <div id="publish-errors" aria-live="polite">
            {errors.length ? (
              <ul className="error" style={{ color: "var(--danger)", margin: 0, paddingLeft: "1.1rem" }}>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {stage.s === "idle" || stage.s === "failed" ? (
            w.status !== "connected" ? (
              <button type="button" className="btn btn-primary" onClick={() => w.connect()} disabled={w.status === "unavailable" || w.status === "connecting"}>
                {w.status === "unavailable" ? "No browser wallet detected" : "Connect a wallet to publish"}
              </button>
            ) : !w.onTiramisu ? (
              <button type="button" className="btn btn-primary" onClick={() => w.switchNetwork().catch(() => {})}>
                Switch to Tiramisu
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={preparing || errors.length > 0 || !ack}>
                {preparing ? "Estimating…" : review ? "Sign and publish" : "Review publication fee"}
              </button>
            )
          ) : null}

          {review ? <Notice tone="info" title="Reviewed publication">
            Estimated fee: ≈ {formatGlm(review.cost.totalWei, 8)} test GLM for {review.params.creates?.length} entities and {review.params.ownershipChanges?.length} ownership changes (20% gas margin).<br />
            Signing wallet: <span className="hash">{w.address}</span>. The exact salted payload above is retained for signing. The wallet shows the final fee before approval; edits, account/network changes or five minutes invalidate this quote.
          </Notice> : null}
          {stage.s === "unknown" ? <Notice tone="warn" title="Transaction submitted; confirmation is not yet known">
            {stage.msg} <ExternalLink href={explorerTx(stage.tx)}>Inspect the transaction</ExternalLink> before publishing again.
            <button type="button" className="btn" onClick={async () => {
              if (running.current) return
              running.current = true
              try {
                const result = await submittedResult(stage.tx)
                if (result?.state === "reverted") { setStage({ s: "failed", msg: "The submitted transaction reverted on chain." }); saveTransaction("muniment.publish.pending", null); setReview(null) }
                else if (result?.state === "confirmed" && result.created[0]) setStage({ s: "readback-pending", tx: stage.tx, key: result.created[0] })
                else setStage({ ...stage, msg: "No confirmed receipt is available yet." })
              } catch (err) { setStage({ ...stage, msg: describeWalletError(err) }) }
              finally { running.current = false }
            }}>Recheck submitted transaction (no signature)</button>
          </Notice> : null}
          {stage.s === "signing" ? <Notice tone="info">Waiting for your wallet. Nothing has been sent yet.</Notice> : null}
          {stage.s === "submitted" ? (
            <Notice tone="info" title="Submitted">
              <ExternalLink href={explorerTx(stage.tx)}>{shortHex(stage.tx, 10, 8)}</ExternalLink> is waiting for a block.
            </Notice>
          ) : null}
          {stage.s === "confirmed" || stage.s === "readback-pending" ? (
            <Notice tone={stage.s === "confirmed" ? "info" : "warn"} title="Confirmed in a block">
              {stage.s === "confirmed" ? "Waiting for the record to be readable from this endpoint…" : "Reading it back is delayed. The transaction succeeded; do not publish it again."}{" "}
              <Link to={`/records/${stage.key}`}>Open the record</Link> · <ExternalLink href={explorerTx(stage.tx)}>transaction</ExternalLink>
            </Notice>
          ) : null}
          {stage.s === "visible" ? (
            <Notice tone="ok" title="Published">
              Read back from Arkiv. <Link to={`/records/${stage.key}`}>Open the record</Link> ·{" "}
              <ExternalLink href={explorerTx(stage.tx)}>transaction</ExternalLink>
            </Notice>
          ) : null}
          {stage.s === "visible" || stage.s === "readback-pending" ? <button type="button" className="btn" onClick={() => {
            saveTransaction("muniment.publish.pending", null); setStage({ s: "idle" }); setReview(null); setAck(false)
          }}>Prepare a different synthetic record</button> : null}
          {stage.s === "failed" ? (
            <Notice tone="danger" title="Not published">
              {stage.msg}
              {stage.tx ? " The transaction was broadcast; check the explorer before trying again." : ""}
            </Notice>
          ) : null}
          <p className="faint" style={{ fontSize: "0.85rem" }}>
            Fees are paid in test GLM from the <ExternalLink href={TIRAMISU.faucet}>Arkiv faucet</ExternalLink>. Developers can publish larger
            synthetic sets with the scripts in the repository.
          </p>
        </form>
        <aside className="stack" aria-label="Preview">
          <h2 style={{ fontSize: "var(--step-2)" }}>Exactly what will be published</h2>
          <p className="muted">Queryable attributes (indexed):</p>
          <pre className="code-block" tabIndex={0} aria-label="Attributes preview">
            {[
              `app = "${APP}"`,
              `schema = ${SCHEMA_VERSION}`,
              `kind = "reply"`,
              "synthetic = true",
              `authority = "${authority}"`,
              `jurisdiction = "${JUR[authority].slug}"`,
              `topic = "${topic}"`,
              `outcome = "${outcome}"`,
              `filed_ms = ${filedOk ? filedMs : "?"} (u64)`,
              repliedMs !== null ? `replied_ms = ${repliedMs} (u64)\nresponse_days = ${daysNum} (i32)` : "# no reply date: unanswered",
              effSections[0] ? `exemption = "${effSections[0]}"` : "# no exemption",
              `ref = "${ref}"`,
            ].join("\n")}
          </pre>
          <p className="muted">Payload (application/json, not indexed):</p>
          <pre className="code-block" style={{ maxHeight: "24rem" }} tabIndex={0} aria-label="Payload preview">
            {JSON.stringify(payload, null, 2)}
          </pre>
          <p className="faint" style={{ fontSize: "0.85rem" }}>
            Flags: read-only + permissionless extension. {effSections.length ? `Plus ${effSections.length} exemption relation record(s). ` : ""}
            {seal ? "Ownership handed to 0x…dEaD in the same atomic transaction." : "Ownership stays with your wallet."}
          </p>
        </aside>
      </div>
    </>
  )
}
