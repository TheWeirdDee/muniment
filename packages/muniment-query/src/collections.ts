/**
 * Portable collection format. Collections live in the reader's browser; the export is the only copy
 * that leaves it. Notes are private and excluded unless the user opts in explicitly.
 */
import { type Hex, isEntityKey } from "./schema.js"
import { TIRAMISU } from "./network.js"

export const COLLECTION_FORMAT = "muniment.collection/1"

export type Observation = {
  /** Block the observation was read at, and its approximate wall-clock time (UTC ms). */
  observedAtBlock: string
  observedAtMs: number
  expiresAtBlock: string | null
  creator: Hex | null
  title: string | null
  authority: string | null
}

export type CollectionItem = {
  key: Hex
  addedAtMs: number
  observation: Observation | null
  note?: string
}

export type Collection = {
  id: string
  name: string
  createdAtMs: number
  items: CollectionItem[]
}

export type CollectionExport = {
  format: typeof COLLECTION_FORMAT
  exportedAt: string
  network: { chainId: number; name: string }
  units: { blocks: "Arkiv block height"; time: "UTC milliseconds" }
  includesNotes: boolean
  collections: Collection[]
}

export const IMPORT_LIMITS = { bytes: 1_000_000, collections: 50, items: 500, name: 80, note: 2_000 } as const

export function exportCollections(collections: Collection[], opts: { includeNotes: boolean; now?: Date }): CollectionExport {
  return {
    format: COLLECTION_FORMAT,
    exportedAt: (opts.now ?? new Date()).toISOString(),
    network: { chainId: TIRAMISU.chainId, name: TIRAMISU.name },
    units: { blocks: "Arkiv block height", time: "UTC milliseconds" },
    includesNotes: opts.includeNotes,
    collections: collections.map((c) => ({
      ...c,
      items: c.items.map(({ note, ...rest }) => (opts.includeNotes && note ? { ...rest, note } : rest)),
    })),
  }
}

export type ImportResult =
  | { ok: true; collections: Collection[]; warnings: string[] }
  | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strip control characters from imports
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
  return t.length === 0 ? null : t.slice(0, max)
}

function parseObservation(v: unknown): Observation | null {
  if (!isObj(v)) return null
  const block = typeof v.observedAtBlock === "string" && /^\d{1,20}$/.test(v.observedAtBlock) ? v.observedAtBlock : null
  const ms = typeof v.observedAtMs === "number" && Number.isFinite(v.observedAtMs) ? v.observedAtMs : null
  if (block === null || ms === null) return null
  const exp = typeof v.expiresAtBlock === "string" && /^\d{1,20}$/.test(v.expiresAtBlock) ? v.expiresAtBlock : null
  const creator = typeof v.creator === "string" && /^0x[0-9a-fA-F]{40}$/.test(v.creator) ? (v.creator as Hex) : null
  return {
    observedAtBlock: block,
    observedAtMs: ms,
    expiresAtBlock: exp,
    creator,
    title: cleanText(v.title, 200),
    authority: cleanText(v.authority, 160),
  }
}

/** Validate an untrusted export. Never trusts ids or counts from the file. */
export function importCollections(text: string, opts: { newId: () => string; now?: number }): ImportResult {
  if (text.length > IMPORT_LIMITS.bytes) return { ok: false, error: "File is larger than 1 MB." }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: "File is not valid JSON." }
  }
  if (!isObj(data)) return { ok: false, error: "File is not a Muniment collection export." }
  if (data.format !== COLLECTION_FORMAT) {
    return { ok: false, error: `Unsupported format. Expected "${COLLECTION_FORMAT}".` }
  }
  if (isObj(data.network) && data.network.chainId !== TIRAMISU.chainId) {
    return { ok: false, error: `This export is for chain ${String(data.network.chainId)}, not Tiramisu (${TIRAMISU.chainId}).` }
  }
  if (!Array.isArray(data.collections)) return { ok: false, error: "Export has no collections list." }
  if (data.collections.length > IMPORT_LIMITS.collections) {
    return { ok: false, error: `Exports are limited to ${IMPORT_LIMITS.collections} collections.` }
  }
  const warnings: string[] = []
  const now = opts.now ?? Date.now()
  const out: Collection[] = []
  for (const [ci, raw] of data.collections.entries()) {
    if (!isObj(raw)) {
      warnings.push(`Collection ${ci + 1} was not an object and was skipped.`)
      continue
    }
    const name = cleanText(raw.name, IMPORT_LIMITS.name) ?? `Imported collection ${ci + 1}`
    const items: CollectionItem[] = []
    const seen = new Set<string>()
    const list = Array.isArray(raw.items) ? raw.items : []
    if (list.length > IMPORT_LIMITS.items) warnings.push(`"${name}" had more than ${IMPORT_LIMITS.items} items; the rest were skipped.`)
    let invalid = 0
    let dupes = 0
    for (const it of list.slice(0, IMPORT_LIMITS.items)) {
      if (!isObj(it) || !isEntityKey(it.key)) {
        invalid++
        continue
      }
      const key = (it.key as string).toLowerCase() as Hex
      if (seen.has(key)) {
        dupes++
        continue
      }
      seen.add(key)
      const note = cleanText(it.note, IMPORT_LIMITS.note)
      items.push({
        key,
        addedAtMs: typeof it.addedAtMs === "number" && Number.isFinite(it.addedAtMs) ? it.addedAtMs : now,
        observation: parseObservation(it.observation),
        ...(note ? { note } : {}),
      })
    }
    if (invalid) warnings.push(`"${name}": ${invalid} item(s) without a valid entity key were skipped.`)
    if (dupes) warnings.push(`"${name}": ${dupes} duplicate item(s) were merged.`)
    out.push({
      id: opts.newId(),
      name,
      createdAtMs: typeof raw.createdAtMs === "number" && Number.isFinite(raw.createdAtMs) ? raw.createdAtMs : now,
      items,
    })
  }
  return { ok: true, collections: out, warnings }
}
