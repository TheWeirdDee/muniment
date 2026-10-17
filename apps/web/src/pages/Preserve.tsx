import { BLOCKS_PER_DAY, type Hex, type Reply, decodeReply, expiringQuery, scan, type ArchiveClient } from "muniment-query"
import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ExpiryText, OutcomePill } from "../components/RecordBits"
import { RenewDialog } from "../components/RenewDialog"
import { Notice, Skeleton } from "../components/ui"
import { publicClient, readErrorMessage } from "../lib/arkiv"
import { TRUSTED_PUBLISHERS } from "../lib/config"
import { formatDate, plural } from "../lib/format"
import { fetchHead, useAsync, useHead } from "../lib/hooks"
import { usePageMeta } from "../lib/meta"
import { settings } from "../lib/settings"

const WINDOWS = [14, 30, 60, 120, 365]

export default function Preserve() {
  usePageMeta("Preserve queue", "Synthetic records approaching their Arkiv expiry block, with batch renewal from any wallet.", { path: "/preserve" })
  const [sp, setSp] = useSearchParams()
  const days = WINDOWS.includes(Number(sp.get("within"))) ? Number(sp.get("within")) : 60
  const { anyPublisher } = settings.use()
  const { head } = useHead()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  // Queue refresh removes renewed rows; the open dialog must retain its reviewed selection/results.
  const [renewalKeys, setRenewalKeys] = useState<Hex[]>([])

  const data = useAsync(
    async (signal) => {
      const h = await fetchHead(true)
      const q = expiringQuery(h.block, h.block + BigInt(days * BLOCKS_PER_DAY), anyPublisher ? undefined : TRUSTED_PUBLISHERS)
      const r = await scan<Reply>(publicClient() as unknown as ArchiveClient, q, decodeReply, { maxPages: 5, signal })
      r.records.sort((a, b) => Number((a.expiresAtBlock ?? 0n) - (b.expiresAtBlock ?? 0n)))
      return { ...r, query: q, head: h }
    },
    [days, anyPublisher],
  )

  const records = data.data?.records ?? []
  const allSelected = records.length > 0 && records.every((r) => selected.has(r.key))
  const keys = useMemo(() => records.filter((r) => selected.has(r.key)).map((r) => r.key as Hex), [records, selected])

  const toggle = (k: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Preserve</span>
          <h1>Add time to records nearing expiry.</h1>
          <p className="lede">
            Renewing storage moves a record's expiry block later, so it stays readable for longer. It never changes the reply, and it cannot bring
            back a record that has already expired or been deleted.
          </p>
        </div>
      </section>
      <div className="wrap section stack">
        <div className="cluster" style={{ justifyContent: "space-between" }}>
          <div className="segmented" role="group" aria-label="Expiring within">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={w === days}
                onClick={() => {
                  setSelected(new Set())
                  setSp(w === 60 ? {} : { within: String(w) })
                }}
              >
                {w} days
              </button>
            ))}
          </div>
          <div className="cluster">
            <span className="faint">{plural(keys.length, "selected record")}</span>
            <button type="button" className="btn btn-primary" disabled={keys.length === 0} onClick={() => { setRenewalKeys([...keys]); setOpen(true) }}>
              Renew storage for selected
            </button>
          </div>
        </div>

        <Notice tone="info">
          Ordered by expiry block, soonest first. The list is a bounded read of up to 1,000 records from {anyPublisher ? "any wallet" : "trusted publishers"}
          {data.data ? (data.data.complete ? "; every matching record was read." : "; more exist beyond this bound, so the list is partial.") : "."} A record
          that renews late is not less valuable: "no renewal observed" only means nobody has paid for more time yet.
        </Notice>

        {data.status === "error" ? (
          <Notice tone="danger" title="Could not load the queue">
            {readErrorMessage((data as { error: unknown }).error)}{" "}
            <button type="button" className="btn btn-sm" onClick={data.reload}>
              Try again
            </button>
          </Notice>
        ) : null}
        {data.status === "loading" && !data.data ? <Skeleton lines={5} /> : null}

        {data.data && records.length === 0 ? (
          <div className="empty">
            <h3>Nothing expires in the next {days} days</h3>
            <p className="muted">Try a longer window, or browse the archive.</p>
            <Link className="btn btn-sm" to="/archive">
              Open the archive
            </Link>
          </div>
        ) : null}

        {records.length > 0 ? (
          <div className="table-wrap" role="region" aria-label="Expiring records" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "3rem" }}>
                    <input
                      type="checkbox"
                      aria-label={allSelected ? "Clear selection" : "Select all records"}
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(records.map((r) => r.key)))}
                    />
                  </th>
                  <th scope="col">Record</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Expiry</th>
                  <th scope="col">Renewable by</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.key} className={selected.has(r.key) ? "is-selected" : undefined}>
                    <td>
                      <input type="checkbox" aria-label={`Select ${r.payload.title}`} checked={selected.has(r.key)} onChange={() => toggle(r.key)} />
                    </td>
                    <td>
                      <Link to={`/records/${r.key}`}>{r.payload.title}</Link>
                      <div className="faint" style={{ fontSize: "0.82rem" }}>
                        {r.payload.authorityName} · filed {formatDate(r.filedMs)}
                      </div>
                    </td>
                    <td>
                      <OutcomePill reply={r} />
                    </td>
                    <td>
                      <ExpiryText expiresAt={r.expiresAtBlock} head={head} />
                      <div className="faint mono" style={{ fontSize: "0.75rem" }}>
                        block {r.expiresAtBlock?.toLocaleString("en-GB")}
                      </div>
                    </td>
                    <td>{r.permissionlessExtension ? "Any wallet" : "Owner only"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data.data ? (
          <details className="disclosure">
            <summary>Query used</summary>
            <div className="disclosure-body">
              <pre className="code-block">{data.data.query}</pre>
            </div>
          </details>
        ) : null}
      </div>
      <RenewDialog
        open={open}
        onClose={() => setOpen(false)}
        keys={renewalKeys}
        onDone={() => {
          data.reload()
        }}
      />
    </>
  )
}
