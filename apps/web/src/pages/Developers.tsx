import { BLOCKS_PER_DAY, TIRAMISU, correctionsQuery, exemptionQuery, expiringQuery, kindQuery, linkedQuery, replyQuery } from "muniment-query"
import { useState } from "react"
import { QueryDemo } from "../components/QueryDemo"
import { Address, CopyButton, ExternalLink } from "../components/ui"
import { publicClient, readErrorMessage } from "../lib/arkiv"
import { DASHBOARD_URL, KNOWN_WALLETS, REPO_BLOB, REPO_URL, TRUSTED_PUBLISHERS } from "../lib/config"
import { useHead } from "../lib/hooks"
import { usePageMeta } from "../lib/meta"

const SAMPLE_KEY = `0x${"0".repeat(64)}` as const

function QueryRow({ title, note, q }: { title: string; note: string; q: string }) {
  const [res, setRes] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const runnable = !q.includes(SAMPLE_KEY)
  return (
    <div className="query-row">
      <div className="stack-sm">
        <h3 style={{ fontSize: "var(--step-1)" }}>{title}</h3>
        <p className="muted">{note}</p>
      </div>
      <pre className="code-block">{q}</pre>
      <div className="cluster">
        <CopyButton value={q} label="Copy" />
        {runnable ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const r = await publicClient().query(q, { select: { key: true }, limit: 200 })
                setRes(`${r.entities.length}${r.cursor ? "+ (first page)" : ""} live entities at block ${r.blockNumber.toLocaleString("en-GB")}`)
              } catch (e) {
                setRes(readErrorMessage(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? "Running…" : "Run on Arkiv"}
          </button>
        ) : (
          <span className="faint" style={{ fontSize: "0.85rem" }}>
            Replace the zero key with a record key to run it.
          </span>
        )}
        {res ? (
          <span className="mono faint" aria-live="polite">
            {res}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default function Developers() {
  usePageMeta("Developers", "Muniment's public data contract on Arkiv: entity types, attributes, expiry policy, exact queries, the muniment-query package and the standalone reader.", { path: "/developers" })
  const { head } = useHead()
  const h = head?.block ?? 0n
  const creators = TRUSTED_PUBLISHERS
  const queries = [
    { title: "Refused replies from trusted publishers", note: "Compound equality on typed string attributes plus a $creator filter.", q: replyQuery({ outcome: "denied", creators }) },
    { title: "Completed replies that took 31 to 60 days", note: "Numeric range on the i32 response_days attribute. Unanswered records have no value and never match.", q: replyQuery({ responseDaysMin: 31, responseDaysMax: 60, creators }) },
    { title: "Filed in the first quarter of 2026", note: "Range on filed_ms (u64 milliseconds, UTC).", q: replyQuery({ filedFromMs: Date.UTC(2026, 0, 1), filedToMs: Date.UTC(2026, 2, 31), creators }) },
    { title: "Every reply citing section 8(1)(j)", note: "Relation entities cover primary and secondary sections; read reply keys from their reply attribute.", q: exemptionQuery("8(1)(j)", creators) },
    { title: "Replies expiring in the next 30 days", note: "Range on the system attribute $expiresAt (u64 block height), from the current head.", q: head ? expiringQuery(h, h + BigInt(30 * BLOCKS_PER_DAY), creators) : "Waiting for the current block…" },
    { title: "All appeals", note: "Appeals link to their reply with a key-typed reply attribute.", q: kindQuery("appeal", creators) },
    { title: "Everything linked to one reply", note: "Run once per kind: appeal, exemption, receipt, review.", q: linkedQuery("review", SAMPLE_KEY) },
    { title: "Corrections of one reply", note: "Check that the correction's creator matches the original's before treating it as supersession.", q: correctionsQuery(SAMPLE_KEY) },
  ]
  const curl = `curl ${TIRAMISU.httpRpc} \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"arkiv_query","params":["${replyQuery({ outcome: "denied", creators }).replaceAll("'", "'\\''")}",{"limit":"0x14","select":{"key":true,"creator":true,"expiresAt":true,"attributes":true,"payload":true}}]}'`
  const pkg = `import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http } from "viem"
import { createArchiveReader, verifyRenewalReceipt } from "muniment-query"

const client = createPublicClient({ chain: tiramisu, transport: http() })
const archive = createArchiveReader(client)

const page = await archive.searchReplies({ outcome: "denied", creators: ["${creators[0]}"] }, { limit: 20 })
for (const r of page.records) console.log(r.key, r.payload.title, r.responseDays)

const linked = await archive.getLinked(page.records[0].key)
for (const receipt of linked.receipts) console.log(await verifyRenewalReceipt(client, receipt))`

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Developers</span>
          <h1>Build on the same records</h1>
          <p className="lede">
            The archive is a public, versioned data contract on Arkiv. You don't need permission, an API key or this website to use it.
          </p>
          <div className="cluster" style={{ marginTop: "var(--space-5)" }}>
            <ExternalLink href={`${REPO_BLOB}/arkiv/schema.md`} className="btn btn-primary">
              Read the data contract
            </ExternalLink>
            <ExternalLink href={REPO_URL} className="btn">
              Source code
            </ExternalLink>
          </div>
        </div>
      </section>
      <div className="wrap">
        <section className="section" id="contract">
          <h2>Entities</h2>
          <div className="table-wrap" role="region" aria-label="Entity types" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">kind</th>
                  <th scope="col">Query attributes</th>
                  <th scope="col">Flags</th>
                  <th scope="col">Lifetime</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">reply</td>
                  <td>authority, jurisdiction, topic, outcome, language, ref (str); filed_ms, replied_ms (u64); response_days (i32); exemption (str); corrects (key); synthetic (bool)</td>
                  <td>read-only, permissionless extension; usually sealed</td>
                  <td>Seed corpus: 21–180 days; Publish: 7, 30, 90 or 180 days; then renewed</td>
                </tr>
                <tr>
                  <td className="mono">appeal</td>
                  <td>reply (key), stage, outcome (str), filed_ms (u64)</td>
                  <td>read-only, permissionless extension</td>
                  <td>Same block as its reply at creation</td>
                </tr>
                <tr>
                  <td className="mono">exemption</td>
                  <td>reply (key), section (str)</td>
                  <td>read-only, permissionless extension</td>
                  <td>Same block as its reply</td>
                </tr>
                <tr>
                  <td className="mono">receipt</td>
                  <td>reply (key), target_expiry (u64)</td>
                  <td>read-only</td>
                  <td>Until the expiry it claims</td>
                </tr>
                <tr>
                  <td className="mono">review</td>
                  <td>reply (key), status (str)</td>
                  <td>read-only, permissionless extension</td>
                  <td>365 days</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ marginTop: "var(--space-3)" }}>
            Every entity also carries app = "muniment-archive" and schema = 1. Those prove nothing about authorship: filter by $creator.
          </p>
        </section>

        <section className="section" id="playground">
          <h2>Try a query</h2>
          <p className="muted measure" style={{ marginBottom: "var(--space-4)" }}>
            Pick an example, edit it and run it against live Arkiv. You see the exact query, the block it was read at and the raw response.
          </p>
          <QueryDemo />
        </section>

        <section className="section" id="queries">
          <h2>Exact queries</h2>
          <p className="muted measure">These are the strings the app sends. Run them here, or paste them into any client that speaks arkiv_query.</p>
          <div className="stack">
            {queries.map((x) => (
              <QueryRow key={x.title} {...x} />
            ))}
          </div>
          <h3 style={{ fontSize: "var(--step-2)", marginTop: "var(--space-6)" }}>With curl</h3>
          <pre className="code-block">{curl}</pre>
          <CopyButton value={curl} label="Copy curl" />
        </section>

        <section className="section" id="package">
          <h2>muniment-query</h2>
          <p className="muted measure">
            A TypeScript package with the schema validators, query builders, reader, renewal planner and receipt verifier this site uses. It is not
            published to the npm registry; install it from the repository's release tarball or the workspace.
          </p>
          <pre className="code-block">{`npm install @arkiv-network/sdk@0.8.1 viem
npm install ${REPO_URL}/releases/download/muniment-query-v0.1.1/muniment-query-0.1.1.tgz`}</pre>
          <pre className="code-block">{pkg}</pre>
          <p>
            <ExternalLink href={`${REPO_BLOB}/packages/muniment-query/README.md`}>Package README</ExternalLink> ·{" "}
            <ExternalLink href={DASHBOARD_URL}>A separate app built on it</ExternalLink>
          </p>
        </section>

        <section className="section" id="reader">
          <h2>Standalone reader</h2>
          <p className="muted measure">
            One HTML file with inline code and styles, no CDN and no Muniment API. It talks raw JSON-RPC to the endpoint you choose. Save it and open it
            from disk, or serve it from any static host.
          </p>
          <div className="cluster">
            <a href="/reader.html" className="btn">
              Open the reader
            </a>
            <a href="/reader.html" download="muniment-reader.html" className="btn">
              Download reader.html
            </a>
          </div>
        </section>

        <section className="section" id="wallets">
          <h2>Wallets that create Muniment entities</h2>
          <ul className="stack-sm" style={{ listStyle: "none", padding: 0 }}>
            {Object.entries(KNOWN_WALLETS).map(([a, label]) => (
              <li key={a}>
                <Address value={a} label={false} /> <span className="muted">— {label}</span>
              </li>
            ))}
          </ul>
          <p className="faint">All are team-controlled test wallets except 0x…dEaD, a conventional burn address that is widely assumed to have no usable key.</p>
        </section>
      </div>
    </>
  )
}
