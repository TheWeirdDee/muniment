/**
 * Query strings in Arkiv's query language. Muniment builds raw strings (rather than SDK expression
 * objects) so the same text runs through the SDK's `client.query()`, a bare `arkiv_query` JSON-RPC
 * call, the standalone reader, and the docs. Every query is pinned to the Muniment namespace and
 * schema version; trust still comes from `$creator`, never from these attributes.
 */
import { APP, OUTCOMES, type Hex, type Outcome, SCHEMA_VERSION, isEntityKey, isValidSection } from "./schema.js"

export class QueryInputError extends Error {}

/** A string literal with the language's only escape (a doubled quote). Control characters are refused. */
export function strLit(value: string): string {
  if (value.length > 128) throw new QueryInputError("string literal longer than 128 characters")
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new QueryInputError("control characters are not allowed")
  return `str('${value.replaceAll("'", "''")}')`
}

export function u64Lit(value: bigint | number): string {
  const v = BigInt(value)
  if (v < 0n || v >= 2n ** 64n) throw new QueryInputError("u64 out of range")
  return `u64(${v.toString()})`
}

export function i32Lit(value: number): string {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
    throw new QueryInputError("i32 out of range")
  }
  return `i32(${value})`
}

export function keyLit(value: string): string {
  if (!isEntityKey(value)) throw new QueryInputError("not an entity key")
  return `key(${value.toLowerCase()})`
}

export function addrLit(value: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new QueryInputError("not an address")
  return `addr(${value})`
}

export function namespace(kind: string): string[] {
  return [`app = ${strLit(APP)}`, `schema = ${i32Lit(SCHEMA_VERSION)}`, `kind = ${strLit(kind)}`]
}

function creatorClause(creators: readonly string[] | undefined): string[] {
  if (!creators || creators.length === 0) return []
  if (creators.length > 16) throw new QueryInputError("at most 16 trusted creators per query")
  const parts = creators.map((c) => `$creator = ${addrLit(c)}`)
  return [parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`]
}

export type ReplyFilters = {
  authority?: string
  jurisdiction?: string
  topic?: string
  outcome?: Outcome
  /** Primary exemption section stored on the reply itself. Secondary sections: see exemptionQuery. */
  exemption?: string
  /** Inclusive, UTC milliseconds. */
  filedFromMs?: number
  /** Inclusive, UTC milliseconds. */
  filedToMs?: number
  /** Completed response duration in days (excludes unanswered records by construction). */
  responseDaysMin?: number
  responseDaysMax?: number
  /** Restrict to authentic on-chain creators. Empty or omitted means any wallet. */
  creators?: readonly string[]
}

export function replyQuery(f: ReplyFilters = {}): string {
  const c = [...namespace("reply"), `synthetic = true`]
  if (f.authority) c.push(`authority = ${strLit(f.authority)}`)
  if (f.jurisdiction) c.push(`jurisdiction = ${strLit(f.jurisdiction)}`)
  if (f.topic) c.push(`topic = ${strLit(f.topic)}`)
  if (f.outcome) {
    if (!(OUTCOMES as readonly string[]).includes(f.outcome)) throw new QueryInputError("unknown outcome")
    c.push(`outcome = ${strLit(f.outcome)}`)
  }
  if (f.exemption) {
    if (!isValidSection(f.exemption)) throw new QueryInputError("malformed exemption section")
    c.push(`exemption = ${strLit(f.exemption)}`)
  }
  if (f.filedFromMs !== undefined) c.push(`filed_ms >= ${u64Lit(f.filedFromMs)}`)
  if (f.filedToMs !== undefined) c.push(`filed_ms <= ${u64Lit(f.filedToMs)}`)
  if (f.responseDaysMin !== undefined) c.push(`response_days >= ${i32Lit(f.responseDaysMin)}`)
  if (f.responseDaysMax !== undefined) c.push(`response_days <= ${i32Lit(f.responseDaysMax)}`)
  c.push(...creatorClause(f.creators))
  return c.join(" AND ")
}

/** Exemption relation entities for a section (covers primary and secondary sections). */
export function exemptionQuery(section: string, creators?: readonly string[]): string {
  if (!isValidSection(section)) throw new QueryInputError("malformed exemption section")
  return [...namespace("exemption"), `section = ${strLit(section)}`, ...creatorClause(creators)].join(" AND ")
}

/** Records of one kind that reference a reply through their `reply` key attribute. */
export function linkedQuery(kind: "appeal" | "exemption" | "receipt" | "review", reply: Hex): string {
  return [...namespace(kind), `reply = ${keyLit(reply)}`].join(" AND ")
}

/**
 * Every appeal, exemption, receipt and review that references a reply, in one query. All four kinds
 * share the key-typed `reply` attribute, so one bounded read replaces four.
 */
export function allLinkedQuery(reply: Hex): string {
  return [`app = ${strLit(APP)}`, `schema = ${i32Lit(SCHEMA_VERSION)}`, `reply = ${keyLit(reply)}`].join(" AND ")
}

/** Replies that declare themselves corrections of `reply`. Authorship is checked by the caller. */
export function correctionsQuery(reply: Hex): string {
  return [...namespace("reply"), `corrects = ${keyLit(reply)}`].join(" AND ")
}

/** Live replies whose expiry block lies in [fromBlock, toBlock]. */
export function expiringQuery(fromBlock: bigint, toBlock: bigint, creators?: readonly string[]): string {
  if (toBlock < fromBlock) throw new QueryInputError("toBlock precedes fromBlock")
  return [
    ...namespace("reply"),
    `$expiresAt >= ${u64Lit(fromBlock)}`,
    `$expiresAt <= ${u64Lit(toBlock)}`,
    ...creatorClause(creators),
  ].join(" AND ")
}

/** Entities by key, chunked so a single query stays inside node predicate budgets. */
export function keysQuery(keys: readonly string[]): string {
  if (keys.length === 0) throw new QueryInputError("no keys")
  if (keys.length > 20) throw new QueryInputError("at most 20 keys per query")
  const parts = keys.map((k) => `$key = ${keyLit(k)}`)
  return `app = ${strLit(APP)} AND (${parts.join(" OR ")})`
}

/** Every entity of a kind in the namespace, optionally creator-filtered. */
export function kindQuery(kind: string, creators?: readonly string[]): string {
  return [...namespace(kind), ...creatorClause(creators)].join(" AND ")
}

