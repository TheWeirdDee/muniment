import { type Hex, TIRAMISU, explorerTx, formatGlm } from "muniment-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAnnounce } from "../lib/announce"
import { readErrorMessage } from "../lib/arkiv"
import { blocksToDuration, formatBlock, plural, shortHex } from "../lib/format"
import { COVERAGE_OPTIONS, type Discovery, type Quote, batchParams, discover, quote, staleCheck, verifyCreatedReceipt, waitForVisibility } from "../lib/renew"
import { describeWalletError, useWallet } from "../lib/wallet"
import { Dialog, ExternalLink, Notice } from "./ui"

type BatchStatus =
  | { s: "waiting" }
  | { s: "checking" }
  | { s: "signing" }
  | { s: "submitted"; tx: Hex }
  | { s: "confirmed"; tx: Hex }
  | { s: "visible"; tx: Hex; ms: number | null }
  | { s: "verified"; tx: Hex; renewer: Hex }
  | { s: "unverified"; tx: Hex; reason: string }
  | { s: "failed"; error: string; tx?: Hex }
  | { s: "stale"; changed: string[] }

const STAGE_TEXT: Record<BatchStatus["s"], string> = {
  waiting: "Not started",
  checking: "Re-reading chain state",
  signing: "Waiting for your wallet to approve",
  submitted: "Submitted, waiting for a block",
  confirmed: "Confirmed in a block, waiting for this endpoint to show it",
  visible: "New expiry visible, checking the receipt",
  verified: "Verified renewal",
  unverified: "Extended, but the receipt could not be verified",
  failed: "Failed",
  stale: "Quote out of date",
}

export function RenewDialog({ open, onClose, keys, onDone }: { open: boolean; onClose: () => void; keys: Hex[]; onDone?: () => void }) {
  const w = useWallet()
  const announce = useAnnounce()
  const [days, setDays] = useState<number>(180)
  const [disc, setDisc] = useState<{ state: "idle" | "loading" } | { state: "ready"; d: Discovery } | { state: "error"; msg: string }>({ state: "idle" })
  const [q, setQ] = useState<{ state: "idle" | "loading" } | { state: "ready"; q: Quote } | { state: "error"; msg: string }>({ state: "idle" })
  const [batches, setBatches] = useState<BatchStatus[]>([])
  const [balance, setBalance] = useState<bigint | null>(null)
  const running = useRef(false)
  const [busy, setBusy] = useState(false)

  const renewer = w.status === "connected" && w.onTiramisu ? w.address : null

  const load = useCallback(async () => {
    setDisc({ state: "loading" })
    setQ({ state: "idle" })
    setBatches([])
    try {
      const d = await discover(keys)
      setDisc({ state: "ready", d })
    } catch (e) {
      setDisc({ state: "error", msg: readErrorMessage(e) })
    }
  }, [keys])

  useEffect(() => {
    if (open) load()
    else {
      setDisc({ state: "idle" })
      setQ({ state: "idle" })
      setBatches([])
    }
  }, [open, load])

  useEffect(() => {
    if (disc.state !== "ready") return
    let alive = true
    setQ({ state: "loading" })
    quote(disc.d, { renewer, days })
      .then((r) => {
        if (!alive) return
        setQ({ state: "ready", q: r })
        setBatches(r.plan.batches.map(() => ({ s: "waiting" })))
        announce(`Quote ready: ${r.plan.extendCount} records in ${r.plan.batches.length} transaction${r.plan.batches.length === 1 ? "" : "s"}.`)
      })
      .catch((e) => alive && setQ({ state: "error", msg: /revert|NotOwner|execution/i.test(String(e)) ? describeWalletError(e) : readErrorMessage(e) }))
    return () => {
      alive = false
    }
  }, [disc, days, renewer, announce])

  useEffect(() => {
    if (!renewer) {
      setBalance(null)
      return
    }
    w.balance().then(setBalance).catch(() => setBalance(null))
  }, [renewer, w.balance, q])

  const setBatch = (i: number, s: BatchStatus) => setBatches((prev) => prev.map((b, j) => (j === i ? s : b)))

  const run = async () => {
    if (running.current || q.state !== "ready" || !renewer) return
    running.current = true
    setBusy(true)
    const quoteNow = q.q
    const target = quoteNow.plan.targetBlock
    try {
      for (const [i, batch] of quoteNow.plan.batches.entries()) {
        if (batches[i] && (batches[i].s === "verified" || batches[i].s === "unverified" || batches[i].s === "visible")) continue
        setBatch(i, { s: "checking" })
        const changed = await staleCheck(batch, quoteNow)
        if (changed.length > 0 || Date.now() - quoteNow.createdAtMs > 5 * 60_000) {
          setBatch(i, { s: "stale", changed })
          announce("The quote is out of date. Refresh it before signing.")
          break
        }
        setBatch(i, { s: "signing" })
        announce(`Transaction ${i + 1}: approve it in your wallet.`)
        let submitted: Hex | undefined
        try {
          const signer = w.signer((hash) => {
            submitted = hash
            setBatch(i, { s: "submitted", tx: hash })
            announce(`Transaction ${i + 1} submitted.`)
          })
          const res = await signer.executeBatch(batchParams(batch, target))
          setBatch(i, { s: "confirmed", tx: res.txHash })
          const ms = await waitForVisibility(batch[0].reply, target)
          setBatch(i, { s: "visible", tx: res.txHash, ms })
          const v = await verifyCreatedReceipt(res.createdEntities[0] as Hex)
          if (v.state === "verified") {
            setBatch(i, { s: "verified", tx: res.txHash, renewer: v.renewer })
            announce(`Transaction ${i + 1} verified.`)
          } else {
            setBatch(i, { s: "unverified", tx: res.txHash, reason: v.reason })
          }
        } catch (err) {
          setBatch(i, { s: "failed", error: describeWalletError(err), tx: submitted })
          announce(`Transaction ${i + 1} failed.`)
          break
        }
      }
    } finally {
      running.current = false
      setBusy(false)
      onDone?.()
    }
  }

  const doneCount = batches.filter((b) => b.s === "verified" || b.s === "unverified").length
  const anyStarted = batches.some((b) => b.s !== "waiting")
  const finished = batches.length > 0 && doneCount === batches.length
  const insufficient = q.state === "ready" && balance !== null && balance < q.q.totalWei

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={keys.length === 1 ? "Renew storage for this record" : `Renew storage for ${plural(keys.length, "record")}`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {finished ? "Close" : "Cancel"}
          </button>
          {batches.some((b) => b.s === "stale" || b.s === "failed") ? (
            <button type="button" className="btn" onClick={load} disabled={busy}>
              Refresh quote for remaining work
            </button>
          ) : null}
          {!finished ? (
            w.status !== "connected" ? (
              <button type="button" className="btn btn-primary" onClick={() => w.connect()} disabled={w.status === "connecting" || w.status === "unavailable"}>
                {w.status === "unavailable" ? "No wallet detected" : "Connect a wallet to sign"}
              </button>
            ) : !w.onTiramisu ? (
              <button type="button" className="btn btn-primary" onClick={() => w.switchNetwork().catch(() => {})}>
                Switch to Tiramisu
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={run}
                disabled={busy || q.state !== "ready" || q.q.plan.batches.length === 0 || insufficient || batches.some((b) => b.s === "stale")}
              >
                {busy ? "Working…" : anyStarted ? "Continue remaining transactions" : `Sign ${q.state === "ready" ? plural(q.q.plan.batches.length, "transaction") : ""}`}
              </button>
            )
          ) : null}
        </>
      }
    >
      <p className="muted">
        Renewing storage moves each record's expiry block later. Your wallet pays the storage fee in test GLM; it gains no right to change the content.
        Linked appeals and exemption notes from the same publisher renew in the same atomic transaction, together with a public receipt that
        anyone can check.
      </p>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }} disabled={busy || anyStarted}>
        <legend className="label" style={{ marginBottom: "0.4rem" }}>
          Renew storage until about
        </legend>
        <div className="segmented" role="group" aria-label="Coverage">
          {COVERAGE_OPTIONS.map((o) => (
            <button key={o.days} type="button" aria-pressed={days === o.days} onClick={() => setDays(o.days)}>
              {o.label}
            </button>
          ))}
        </div>
        <span className="hint">Converted to a block height at 2 seconds per block. Block production is not a clock, so dates are approximate.</span>
      </fieldset>

      {disc.state === "loading" ? <p className="faint">Reading current expiry, permissions and linked records from Arkiv…</p> : null}
      {disc.state === "error" ? <Notice tone="danger" title="Could not read current state">{disc.msg}</Notice> : null}
      {disc.state === "ready" && disc.d.missing.length > 0 ? (
        <Notice tone="warn" title={`${plural(disc.d.missing.length, "record")} not found`}>
          These keys returned nothing from this endpoint: they may have expired, never existed, or the endpoint may be behind. They are left out.
        </Notice>
      ) : null}
      {disc.state === "ready" && disc.d.incompleteLinks.length > 0 ? (
        <Notice tone="warn">Some linked lists were longer than one bounded read. Records beyond that bound are not included.</Notice>
      ) : null}

      {q.state === "loading" ? <p className="faint">Planning batches and estimating fees…</p> : null}
      {q.state === "error" ? <Notice tone="danger" title="Could not prepare a quote">{q.msg}</Notice> : null}
      {q.state === "ready" ? (
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <strong>Plan</strong>
              <span className="faint mono">target block {formatBlock(q.q.plan.targetBlock)}</span>
            </div>
            <div className="panel-body stack-sm">
              <p>
                {plural(q.q.plan.extendCount, "entity", "entities")} will be extended in {plural(q.q.plan.batches.length, "atomic transaction")}, each
                with one receipt per reply.
              </p>
              {q.q.plan.skipped.length > 0 ? (
                <details className="disclosure">
                  <summary>{plural(q.q.plan.skipped.length, "record")} left out</summary>
                  <div className="disclosure-body">
                    <ul className="stack-sm" style={{ paddingLeft: "1.1rem", margin: 0 }}>
                      {q.q.plan.skipped.map((s) => (
                        <li key={s.key}>
                          <span className="hash">{shortHex(s.key)}</span> ({s.kind}): {"detail" in s ? s.detail : s.action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              ) : null}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <strong>Estimated cost</strong>
              <span className="pill pill-info no-dot">Estimate</span>
            </div>
            <div className="panel-body stack-sm">
              <dl className="kv">
                {q.q.perBatch.map((c, i) => (
                  <div key={i} style={{ display: "contents" }}>
                    <dt>Transaction {i + 1}</dt>
                    <dd className="mono">
                      ≈ {formatGlm(c.totalWei, 8)} test GLM ({c.gas.toLocaleString("en-GB")} gas incl. 20% margin)
                    </dd>
                  </div>
                ))}
                <dt>Total</dt>
                <dd className="mono">≈ {formatGlm(q.q.totalWei, 8)} test GLM</dd>
                {balance !== null ? (
                  <>
                    <dt>Your balance</dt>
                    <dd className="mono">{formatGlm(balance, 8)} test GLM</dd>
                  </>
                ) : null}
              </dl>
              <p className="faint" style={{ fontSize: "0.85rem" }}>
                From a gas estimate for the exact calldata at the current gas price{renewer ? "" : ", simulated for an anonymous wallet until you connect"}. The
                final fee can differ. Test GLM has no market value; Muniment shows no fiat price and makes no claim about production costs. Fee
                coverage beyond the target ({blocksToDuration(q.q.plan.targetBlock - q.q.plan.headBlock)}) needs another renewal.
              </p>
              {insufficient ? (
                <Notice tone="warn" title="Not enough test GLM">
                  Claim test GLM from the <ExternalLink href={TIRAMISU.faucet}>Arkiv faucet</ExternalLink>, then refresh the quote.
                </Notice>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {batches.length > 0 && anyStarted ? (
        <ol className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Transaction progress">
          {batches.map((b, i) => (
            <li key={i} className={`notice ${b.s === "verified" ? "notice-ok" : b.s === "failed" || b.s === "stale" ? "notice-danger" : b.s === "unverified" ? "notice-warn" : "notice-info"}`}>
              <strong>
                Transaction {i + 1}: {STAGE_TEXT[b.s]}
              </strong>
              <div className="muted" style={{ fontSize: "0.88rem" }}>
                {"tx" in b && b.tx ? (
                  <ExternalLink href={explorerTx(b.tx)} className="hash">
                    {shortHex(b.tx, 10, 8)}
                  </ExternalLink>
                ) : null}
                {b.s === "visible" && b.ms !== null ? ` · visible after ${(b.ms / 1000).toFixed(1)} s` : null}
                {b.s === "visible" && b.ms === null ? " · not yet visible on this endpoint after 60 s; the chain may still show it" : null}
                {b.s === "unverified" ? ` · ${b.reason}` : null}
                {b.s === "failed" ? ` ${b.error}${b.tx ? " The transaction was broadcast; check it in the explorer before retrying." : ""}` : null}
                {b.s === "stale" ? ` Another renewal or change landed since the quote (${b.changed.length} record(s)). Refresh to re-plan; nothing was signed.` : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {finished ? (
        <Notice tone="ok" title="Done">
          {plural(doneCount, "transaction")} confirmed. The new expiry was read back from Arkiv, not assumed. Earlier transactions stay valid
          even if a later one fails.
        </Notice>
      ) : null}
    </Dialog>
  )
}
