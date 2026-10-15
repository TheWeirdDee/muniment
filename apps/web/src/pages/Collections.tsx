import { type Collection, type Hex, type Reply, exportCollections, importCollections } from "muniment-query"
import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ExpiryText } from "../components/RecordBits"
import { RenewDialog } from "../components/RenewDialog"
import { Dialog, Notice } from "../components/ui"
import { readErrorMessage, reader } from "../lib/arkiv"
import { collectionsStore, createCollection, deleteCollection, mergeImported, newId, removeFromCollection, renameCollection, setNote } from "../lib/collections"
import { formatDateTime, plural, shortHex } from "../lib/format"
import { useHead } from "../lib/hooks"
import { usePageMeta } from "../lib/meta"

type LiveState = { state: "loading" } | { state: "error"; msg: string } | { state: "ready"; found: Map<string, Reply>; block: bigint | null }

export default function Collections() {
  usePageMeta("Collections", "Browser-only collections of synthetic records with export, import and renewal planning.", { path: "/collections" })
  const all = collectionsStore.use()
  const [sp, setSp] = useSearchParams()
  const activeId = sp.get("c") && all.some((c) => c.id === sp.get("c")) ? (sp.get("c") as string) : all[0]?.id
  const active = all.find((c) => c.id === activeId) ?? null
  const [name, setName] = useState("")
  const [importMsg, setImportMsg] = useState<{ tone: "ok" | "danger" | "warn"; text: string; details?: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const storageOk = collectionsStore.persisted()

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Collections</span>
          <h1>Keep related replies together.</h1>
          <p className="lede">
            Collections are saved only in this browser, with no account, sync or backup. Renew storage for a whole collection at once, or export it
            as a JSON citation bundle.
          </p>
        </div>
      </section>
      <div className="wrap section collections-layout">
        <aside className="stack" aria-label="Collections list">
          {!storageOk ? <Notice tone="warn" title="Browser storage is unavailable">Changes last only for this visit. Export before you leave.</Notice> : null}
          <form
            className="stack-sm"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              const c = createCollection(name)
              setName("")
              setSp({ c: c.id })
            }}
          >
            <div className="field">
              <label htmlFor="new-c">New collection</label>
              <input id="new-c" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Kestrel contracts" />
            </div>
            <button type="submit" className="btn btn-sm" disabled={!name.trim()}>
              Create
            </button>
          </form>
          <nav aria-label="Collections">
            <ul className="col-list">
              {all.map((c) => (
                <li key={c.id}>
                  <Link to={`/collections?c=${encodeURIComponent(c.id)}`} aria-current={c.id === activeId ? "page" : undefined}>
                    <span>{c.name}</span>
                    <span className="faint">{c.items.length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="stack-sm">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              id="import-file"
              tabIndex={-1}
              aria-hidden="true"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (!f) return
                if (f.size > 1_000_000) {
                  setImportMsg({ tone: "danger", text: "File is larger than 1 MB." })
                  return
                }
                const r = importCollections(await f.text(), { newId })
                if (!r.ok) setImportMsg({ tone: "danger", text: r.error })
                else {
                  mergeImported(r.collections)
                  setImportMsg({ tone: r.warnings.length ? "warn" : "ok", text: `Imported ${plural(r.collections.length, "collection")}.`, details: r.warnings })
                }
              }}
            />
            <button type="button" className="btn btn-sm" style={{ width: "fit-content" }} onClick={() => fileRef.current?.click()}>
              Import JSON
            </button>
            {importMsg ? (
              <div aria-live="polite">
                <Notice tone={importMsg.tone}>
                  {importMsg.text}
                  {importMsg.details?.length ? (
                    <ul>
                      {importMsg.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  ) : null}
                </Notice>
              </div>
            ) : null}
          </div>
        </aside>
        <section aria-live="off">
          {active ? (
            <CollectionView key={active.id} c={active} onDeleted={() => setSp({})} />
          ) : (
            <div className="empty">
              <h3>No collections yet</h3>
              <p className="muted measure">Create one here, or use "Save to collection" on any record in the archive.</p>
              <Link className="btn btn-sm" to="/archive">
                Find records to save
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function CollectionView({ c, onDeleted }: { c: Collection; onDeleted: () => void }) {
  const { head } = useHead()
  const [live, setLive] = useState<LiveState>({ state: "loading" })
  const [renewOpen, setRenewOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rename, setRename] = useState(c.name)
  const keys = c.items.map((i) => i.key)
  const keyStr = keys.join()

  const reload = () => {
    if (keys.length === 0) {
      setLive({ state: "ready", found: new Map(), block: null })
      return
    }
    setLive({ state: "loading" })
    reader()
      .getReplies(keys)
      .then((r) => setLive({ state: "ready", found: new Map(r.records.map((x) => [x.key, x])), block: null }))
      .catch((e) => setLive({ state: "error", msg: readErrorMessage(e) }))
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when membership changes
  useEffect(reload, [keyStr])

  const found = live.state === "ready" ? live.found : new Map<string, Reply>()
  const missing = live.state === "ready" ? c.items.filter((i) => !found.has(i.key)) : []
  const sorted = [...c.items].sort((a, b) => {
    const ea = found.get(a.key)?.expiresAtBlock ?? -1n
    const eb = found.get(b.key)?.expiresAtBlock ?? -1n
    return ea === -1n ? 1 : eb === -1n ? -1 : Number(ea - eb)
  })

  const download = () => {
    const data = exportCollections([c], { includeNotes })
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `muniment-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "collection"}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExportOpen(false)
  }

  return (
    <div className="stack">
      <div className="cluster" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <form
          className="cluster"
          onSubmit={(e) => {
            e.preventDefault()
            renameCollection(c.id, rename)
          }}
        >
          <div className="field">
            <label htmlFor="rename">Collection name</label>
            <input id="rename" className="input" value={rename} onChange={(e) => setRename(e.target.value)} maxLength={80} />
          </div>
          <button type="submit" className="btn btn-sm" style={{ alignSelf: "end" }} disabled={rename.trim() === c.name || !rename.trim()}>
            Rename
          </button>
        </form>
        <div className="cluster">
          <button type="button" className="btn btn-sm" onClick={() => setExportOpen(true)} disabled={c.items.length === 0}>
            Export
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete collection
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setRenewOpen(true)} disabled={found.size === 0}>
            Renew storage for collection
          </button>
        </div>
      </div>

      {live.state === "error" ? (
        <Notice tone="danger" title="Could not check live state">
          {live.msg}{" "}
          <button type="button" className="btn btn-sm" onClick={reload}>
            Retry
          </button>
        </Notice>
      ) : null}
      {missing.length > 0 ? (
        <Notice tone="warn" title={`${plural(missing.length, "item")} not currently on Arkiv`}>
          Arkiv returned nothing for these keys. Where your saved observation shows an expiry block that has now passed, they most likely expired;
          otherwise the reason is unknown.
        </Notice>
      ) : null}

      {c.items.length === 0 ? (
        <div className="empty">
          <h3>This collection is empty</h3>
          <Link className="btn btn-sm" to="/archive">
            Add records from the archive
          </Link>
        </div>
      ) : (
        <ul className="col-items">
          {sorted.map((item) => {
            const r = found.get(item.key)
            const obsExp = item.observation?.expiresAtBlock ? BigInt(item.observation.expiresAtBlock) : null
            const likelyExpired = !r && live.state === "ready" && head && obsExp !== null && obsExp <= head.block
            return (
              <li key={item.key} className="col-item">
                <div className="stack-sm" style={{ minWidth: 0 }}>
                  {r ? (
                    <Link to={`/records/${item.key}`} style={{ fontWeight: 600 }}>
                      {r.payload.title}
                    </Link>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{item.observation?.title ?? shortHex(item.key, 10, 8)}</span>
                  )}
                  <div className="cluster faint" style={{ fontSize: "0.85rem" }}>
                    {r ? (
                      <ExpiryText expiresAt={r.expiresAtBlock} head={head} />
                    ) : live.state === "loading" ? (
                      <span>Checking…</span>
                    ) : likelyExpired ? (
                      <span className="pill pill-danger no-dot">Expired (observed expiry passed)</span>
                    ) : (
                      <span className="pill pill-warn no-dot">Unavailable, reason unknown</span>
                    )}
                    {item.observation ? <span>Last observed {formatDateTime(item.observation.observedAtMs)}</span> : <span>No saved observation</span>}
                  </div>
                  <label className="field">
                    <span className="label">Private note (stays in this browser)</span>
                    <input className="input" defaultValue={item.note ?? ""} maxLength={2000} onBlur={(e) => setNote(c.id, item.key as Hex, e.target.value)} />
                  </label>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => removeFromCollection(c.id, item.key as Hex)} aria-label={`Remove ${r?.payload.title ?? item.key} from collection`}>
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export collection"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setExportOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={download}>
              Download JSON
            </button>
          </>
        }
      >
        <p>The file contains, for each item: the Arkiv entity key, when you added it, and your last observation (block, approximate time, expiry block, creator, title, claimed authority). Units are stated in the file.</p>
        <label className="check">
          <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
          <span>Include my private notes (off by default; anyone you share the file with can read them)</span>
        </label>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this collection?"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                deleteCollection(c.id)
                setConfirmDelete(false)
                onDeleted()
              }}
            >
              Delete from this browser
            </button>
          </>
        }
      >
        <p>
          "{c.name}" and its private notes will be removed from this browser. The records themselves stay on Arkiv. This cannot be undone unless you
          exported a copy.
        </p>
      </Dialog>
      <RenewDialog open={renewOpen} onClose={() => setRenewOpen(false)} keys={[...found.keys()] as Hex[]} onDone={reload} />
    </div>
  )
}
