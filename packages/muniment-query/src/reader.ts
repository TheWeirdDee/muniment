import { fromSdkEntity } from "./normalize.js"
import {
  allLinkedQuery,
  correctionsQuery,
  keysQuery,
  linkedQuery,
  replyQuery,
  type ReplyFilters,
  exemptionQuery,
} from "./queries.js"
import {
  type AnyRecord,
  type Appeal,
  type DecodeIssue,
  type DecodeResult,
  type Exemption,
  type Hex,
  type RawEntity,
  type Receipt,
  type Reply,
  type Review,
  decodeAny,
  decodeAppeal,
  decodeExemption,
  decodeReceipt,
  decodeReply,
  decodeReview,
  isEntityKey,
  isUnsupportedVersion,
} from "./schema.js"
import { MAX_PAGE_SIZE } from "./network.js"

/**
 * The subset of an `@arkiv-network/sdk` PublicArkivClient that Muniment reads through. Any object
 * with these methods works, which keeps the package testable and lets a caller add caching.
 */
export type ArchiveClient = {
  query(
    query: string,
    options?: { select?: Record<string, unknown>; limit?: number; cursor?: string; atBlock?: bigint },
  ): Promise<{ entities: unknown[]; cursor: string | undefined; blockNumber: bigint }>
  getBlockTiming(): Promise<{ currentBlock: bigint; currentBlockTime: number; blockDuration: number }>
  request(args: { method: string; params?: unknown }): Promise<unknown>
}

export const FULL_SELECT = {
  key: true,
  owner: true,
  creator: true,
  createdAt: true,
  updatedAt: true,
  expiresAt: true,
  creationFlags: true,
  contentType: true,
  payload: true,
  attributes: true,
} as const

export type Page<T> = {
  records: T[]
  issues: DecodeIssue[]
  cursor: string | undefined
  blockNumber: bigint
}

async function page<T>(
  client: ArchiveClient,
  query: string,
  decode: (e: RawEntity) => DecodeResult<T>,
  opts: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
): Promise<Page<T>> {
  opts.signal?.throwIfAborted()
  const limit = Math.min(opts.limit ?? 50, MAX_PAGE_SIZE)
  const res = await client.query(query, { select: FULL_SELECT, limit, cursor: opts.cursor })
  opts.signal?.throwIfAborted()
  const records: T[] = []
  const issues: DecodeIssue[] = []
  const seen = new Set<string>()
  for (const raw of res.entities) {
    const e = fromSdkEntity(raw as Parameters<typeof fromSdkEntity>[0])
    if (seen.has(e.key)) continue
    seen.add(e.key)
    const d = decode(e)
    if (d.ok) records.push(d.value)
    else issues.push(d.issue)
  }
  return { records, issues, cursor: res.cursor, blockNumber: res.blockNumber }
}

export type ScanResult<T> = {
  records: T[]
  issues: DecodeIssue[]
  /** True only when every page was read; otherwise the result is a labelled partial sample. */
  complete: boolean
  pages: number
  blockNumber: bigint | null
}

/** Walk pages up to a bound. Results are deduplicated by entity key across pages. */
export async function scan<T extends { key: Hex }>(
  client: ArchiveClient,
  query: string,
  decode: (e: RawEntity) => DecodeResult<T>,
  opts: { maxPages?: number; pageSize?: number; signal?: AbortSignal } = {},
): Promise<ScanResult<T>> {
  const maxPages = opts.maxPages ?? 10
  const byKey = new Map<string, T>()
  const issues: DecodeIssue[] = []
  let cursor: string | undefined
  let pages = 0
  let blockNumber: bigint | null = null
  do {
    const p = await page(client, query, decode, { limit: opts.pageSize ?? MAX_PAGE_SIZE, cursor, signal: opts.signal })
    pages++
    blockNumber ??= p.blockNumber
    for (const r of p.records) if (!byKey.has(r.key)) byKey.set(r.key, r)
    issues.push(...p.issues)
    cursor = p.cursor
  } while (cursor && pages < maxPages)
  return { records: [...byKey.values()], issues, complete: cursor === undefined, pages, blockNumber }
}

export type LookupResult<T> =
  | { state: "found"; record: T; blockNumber: bigint }
  | { state: "missing"; blockNumber: bigint }
  | { state: "malformed"; reason: string; raw: RawEntity }
  | { state: "unsupported"; raw: RawEntity }
  | { state: "invalid-key" }

export type Linked = {
  appeals: Appeal[]
  exemptions: Exemption[]
  receipts: Receipt[]
  reviews: Review[]
  corrections: Reply[]
  issues: DecodeIssue[]
  /** False when any linked list hit the page bound; the UI must say the list may be incomplete. */
  complete: boolean
}

export function createArchiveReader(client: ArchiveClient) {
  return {
    client,

    searchReplies(filters: ReplyFilters, opts: { limit?: number; cursor?: string; signal?: AbortSignal } = {}) {
      return page(client, replyQuery(filters), decodeReply, opts)
    },

    scanReplies(filters: ReplyFilters, opts: { maxPages?: number; signal?: AbortSignal } = {}) {
      return scan(client, replyQuery(filters), decodeReply, opts)
    },

    /**
     * Replies that list `section` among their exemptions, via relation entities. Returns reply keys;
     * fetch them with getReplies. Relations are filtered by the same creators as the replies.
     */
    async replyKeysForSection(section: string, creators?: readonly string[], signal?: AbortSignal) {
      const r = await scan(client, exemptionQuery(section, creators), decodeExemption, { maxPages: 5, signal })
      return { keys: [...new Set(r.records.map((x) => x.reply))], complete: r.complete }
    },

    async getReplies(keys: readonly Hex[], signal?: AbortSignal): Promise<{ records: Reply[]; issues: DecodeIssue[] }> {
      const unique = [...new Set(keys.map((k) => k.toLowerCase() as Hex))].filter(isEntityKey)
      const records: Reply[] = []
      const issues: DecodeIssue[] = []
      for (let i = 0; i < unique.length; i += 20) {
        const chunk = unique.slice(i, i + 20)
        const r = await scan(client, keysQuery(chunk), decodeReply, { maxPages: 1, signal })
        records.push(...r.records)
        issues.push(...r.issues)
      }
      return { records, issues }
    },

    /** One reply by key, distinguishing missing, malformed and unsupported-version entities. */
    async getReply(key: string): Promise<LookupResult<Reply>> {
      if (!isEntityKey(key)) return { state: "invalid-key" }
      const res = await client.query(`$key = key(${key.toLowerCase()})`, { select: FULL_SELECT, limit: 1 })
      const raw = res.entities[0]
      if (!raw) return { state: "missing", blockNumber: res.blockNumber }
      const e = fromSdkEntity(raw as Parameters<typeof fromSdkEntity>[0])
      if (isUnsupportedVersion(e)) return { state: "unsupported", raw: e }
      const d = decodeReply(e)
      if (!d.ok) return { state: "malformed", reason: d.issue.reason, raw: e }
      return { state: "found", record: d.value, blockNumber: res.blockNumber }
    },

    /** Two bounded reads: everything with `reply = key`, then corrections. Fewer requests, fewer rate limits. */
    async getLinked(key: Hex, signal?: AbortSignal): Promise<Linked> {
      const opts = { maxPages: 3, signal }
      const linked = await scan(client, allLinkedQuery(key), decodeAny, opts)
      const corrections = await scan(client, correctionsQuery(key), decodeReply, opts)
      const of = <K extends AnyRecord["kind"]>(k: K) => linked.records.filter((r) => r.kind === k) as Extract<AnyRecord, { kind: K }>[]
      return {
        appeals: of("appeal"),
        exemptions: of("exemption"),
        receipts: of("receipt"),
        reviews: of("review"),
        corrections: corrections.records.filter((c) => c.key !== key),
        issues: [...linked.issues, ...corrections.issues],
        complete: linked.complete && corrections.complete,
      }
    },

    async head() {
      const t = await client.getBlockTiming()
      return { block: t.currentBlock, timeMs: t.currentBlockTime * 1000 }
    },
  }
}

export type ArchiveReader = ReturnType<typeof createArchiveReader>
