import { BLOCKS_PER_DAY, expiringQuery, kindQuery, replyQuery } from "muniment-query"
import { useState } from "react"
import { readErrorMessage } from "../lib/arkiv"
import { TRUSTED_PUBLISHERS } from "../lib/config"
import { shortHex } from "../lib/format"
import { fetchHead } from "../lib/hooks"
import { settings } from "../lib/settings"
import { AUTHORITIES } from "../lib/vocab"
import { Arrow } from "./ui"

type Op = { id: string; label: string; describe: string; build: (ctx: { head: bigint; authority: string; days: number; creators?: string[] }) => string; fields: ("authority" | "days")[] }

const OPS: Op[] = [
  { id: "refused", label: "Refused replies", describe: "Replies where the authority refused, from trusted publishers.", build: ({ creators }) => replyQuery({ outcome: "denied", creators }), fields: [] },
  { id: "slow", label: "Slower than N days", describe: "Completed replies whose response time exceeds a threshold. A numeric range on an i32 attribute.", build: ({ days, creators }) => replyQuery({ responseDaysMin: days + 1, creators }), fields: ["days"] },
  { id: "unanswered", label: "No reply recorded", describe: "Applications with no reply. They carry no reply date, so they never appear in response-time ranges.", build: ({ creators }) => replyQuery({ outcome: "no-reply", creators }), fields: [] },
  { id: "authority", label: "By authority", describe: "Every reply attributed to one synthetic authority.", build: ({ authority, creators }) => replyQuery({ authority, creators }), fields: ["authority"] },
  { id: "expiring", label: "Expiring soon", describe: "Replies whose $expiresAt block falls within the next N days.", build: ({ head, days, creators }) => expiringQuery(head, head + BigInt(days * BLOCKS_PER_DAY), creators), fields: ["days"] },
  { id: "appeals", label: "Appeals", describe: "Appeal records, which link to their reply through a key attribute.", build: ({ creators }) => kindQuery("appeal", creators), fields: [] },
]

type RunResult = { ms: number; count: number; more: boolean; block: string; titles: string[]; raw: string }

export function QueryDemo() {
  const [opId, setOpId] = useState(OPS[0].id)
  const [authority, setAuthority] = useState(AUTHORITIES[0].slug)
  const [days, setDays] = useState(30)
  const [state, setState] = useState<{ s: "idle" } | { s: "running" } | { s: "done"; r: RunResult } | { s: "error"; msg: string }>({ s: "idle" })
  const op = OPS.find((o) => o.id === opId) ?? OPS[0]
  const [headBlock, setHeadBlock] = useState<bigint | null>(null)
  const q = op.build({ head: headBlock ?? 0n, authority, days, creators: TRUSTED_PUBLISHERS })
  const endpoint = settings.get().rpcUrl

  const run = async () => {
    setState({ s: "running" })
    try {
      const h = await fetchHead(true)
      setHeadBlock(h.block)
      const query = op.build({ head: h.block, authority, days, creators: TRUSTED_PUBLISHERS })
      const t0 = performance.now()
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "arkiv_query", params: [query, { limit: "0x32", select: { key: true, attributes: true, payload: true } }] }),
      })
      const ms = Math.round(performance.now() - t0)
      const body = (await res.json()) as { result?: { data: { key: string; payload?: string; attributes: { name: string; value: unknown }[] }[]; blockNumber: string; cursor?: string }; error?: { message: string } }
      if (body.error || !body.result) throw new Error(body.error?.message ?? `HTTP ${res.status}`)
      const titles = body.result.data.slice(0, 3).map((e) => {
        try {
          const hex = e.payload ?? "0x"
          const bytes = new Uint8Array((hex.slice(2).match(/../g) ?? []).map((b) => Number.parseInt(b, 16)))
          const j = JSON.parse(new TextDecoder().decode(bytes)) as { title?: string; grounds?: string }
          return (j.title ?? j.grounds ?? shortHex(e.key)).slice(0, 90)
        } catch {
          return shortHex(e.key)
        }
      })
      const first = body.result.data[0]
      const raw = JSON.stringify(
        { blockNumber: body.result.blockNumber, cursor: body.result.cursor ?? null, count: body.result.data.length, first: first ? { key: first.key, attributes: first.attributes, payload: `${(first.payload ?? "").slice(0, 66)}…` } : null },
        null,
        2,
      )
      setState({ s: "done", r: { ms, count: body.result.data.length, more: !!body.result.cursor, block: BigInt(body.result.blockNumber).toLocaleString("en-GB"), titles, raw } })
    } catch (e) {
      setState({ s: "error", msg: readErrorMessage(e) })
    }
  }

  return (
    <div className="demo-frame">
      <div className="demo-ops" role="tablist" aria-label="Example queries" aria-orientation="vertical">
        {OPS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={o.id === opId}
            className="demo-op"
            onClick={() => {
              setOpId(o.id)
              setState({ s: "idle" })
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="demo-work" role="tabpanel" aria-label={op.label}>
        <div className="demo-meta">
          <span className="mono">POST arkiv_query</span>
          <span className="mono faint">{new URL(endpoint).host}</span>
        </div>
        <div className="demo-grid">
          <div className="demo-req">
            <span className="eyebrow">Request</span>
            <p className="muted" style={{ margin: "0.6rem 0 1rem" }}>
              {op.describe}
            </p>
            {op.fields.includes("authority") ? (
              <div className="field">
                <label htmlFor="demo-auth">Authority</label>
                <select id="demo-auth" className="select" value={authority} onChange={(e) => setAuthority(e.target.value)}>
                  {AUTHORITIES.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {op.fields.includes("days") ? (
              <div className="field">
                <label htmlFor="demo-days">Days</label>
                <input id="demo-days" className="input" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} />
              </div>
            ) : null}
            <pre className="code-block demo-code" aria-label="Query string">
              {op.id === "expiring" && headBlock === null ? q.replace(/u64\(\d+\)/g, "u64(<head>)") : q}
            </pre>
            <button type="button" className="btn btn-primary" onClick={run} disabled={state.s === "running"}>
              {state.s === "running" ? "Querying Arkiv…" : "Run on Arkiv"}
              <Arrow />
            </button>
            <span className="faint" style={{ fontSize: "0.82rem", marginLeft: "0.75rem" }}>
              Runs from your browser. No wallet, no Muniment server.
            </span>
          </div>
          <div className="demo-res" aria-live="polite">
            <span className="eyebrow">Response</span>
            {state.s === "idle" ? <p className="faint" style={{ marginTop: "0.8rem" }}>Run the query to see live results.</p> : null}
            {state.s === "running" ? <p className="faint" style={{ marginTop: "0.8rem" }}>Waiting for the node…</p> : null}
            {state.s === "error" ? <p style={{ marginTop: "0.8rem", color: "var(--danger)" }}>{state.msg}</p> : null}
            {state.s === "done" ? (
              <>
                <p className="demo-count">
                  {state.r.count}
                  {state.r.more ? "+" : ""}
                </p>
                <p className="muted">matching live entities{state.r.more ? " (first page of 50)" : ""}</p>
                <div className="demo-detail">
                  <span>block {state.r.block}</span>
                  <span>{state.r.ms} ms</span>
                </div>
                <ul className="demo-titles">
                  {state.r.titles.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <details className="disclosure">
                  <summary>JSON response</summary>
                  <div className="disclosure-body">
                    <pre className="code-block" style={{ maxHeight: "16rem" }} tabIndex={0} aria-label="JSON response">
                      {state.r.raw}
                    </pre>
                  </div>
                </details>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

