import { OUTCOMES, OUTCOME_LABELS, type Reply } from "muniment-query"
import { ExternalLink, Notice, Skeleton } from "../components/ui"
import { readErrorMessage, reader } from "../lib/arkiv"
import { DASHBOARD_URL, TRUSTED_PUBLISHERS } from "../lib/config"
import { plural } from "../lib/format"
import { useAsync } from "../lib/hooks"
import { usePageMeta } from "../lib/meta"
import { authorityName } from "../lib/vocab"

export default function Insights() {
  usePageMeta("Insights", "Counts of synthetic replies by authority and outcome, read live from Arkiv, plus the separately hosted response-time dashboard.", { path: "/insights" })
  const data = useAsync((signal) => reader().scanReplies({ creators: TRUSTED_PUBLISHERS }, { maxPages: 5, signal }), [])
  const recs: Reply[] = data.data?.records ?? []
  const byAuth = new Map<string, Reply[]>()
  for (const r of recs) byAuth.set(r.authority, [...(byAuth.get(r.authority) ?? []), r])

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Insights</span>
          <h1>Explore response times in the demo archive.</h1>
          <p className="lede">
            These counts are real reads from Arkiv, of invented records about fictional authorities. A separate dashboard, on another site, charts
            the same records from the public data contract.
          </p>
          <div className="cluster" style={{ marginTop: "var(--space-5)" }}>
            <ExternalLink href={DASHBOARD_URL} className="btn btn-primary">
              Open the response-time dashboard
            </ExternalLink>
          </div>
        </div>
      </section>
      <div className="wrap section stack">
        <Notice tone="warn" title="Synthetic data">
          These figures describe invented test records for fictional authorities. They say nothing about any real office's performance.
        </Notice>
        {data.status === "error" ? <Notice tone="danger">{readErrorMessage((data as { error: unknown }).error)}</Notice> : null}
        {!data.data && data.status !== "error" ? <Skeleton lines={5} /> : null}
        {data.data ? (
          <>
            <p className="muted">
              {plural(recs.length, "live reply", "live replies")} from trusted publishers, read at block {data.data.blockNumber?.toLocaleString("en-GB")}.{" "}
              {data.data.complete ? "Every page was read." : "The scan hit its bound, so these counts are partial."} Expired records are not included.
            </p>
            <div className="table-wrap" role="region" aria-label="Replies by authority and outcome" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Authority (synthetic)</th>
                    <th scope="col">Replies</th>
                    {OUTCOMES.map((o) => (
                      <th key={o} scope="col">
                        {OUTCOME_LABELS[o]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...byAuth.entries()]
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([a, list]) => (
                      <tr key={a}>
                        <th scope="row">{authorityName(a)}</th>
                        <td className="mono">{list.length}</td>
                        {OUTCOMES.map((o) => (
                          <td key={o} className="mono">
                            {list.filter((r) => r.outcome === o).length}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}
