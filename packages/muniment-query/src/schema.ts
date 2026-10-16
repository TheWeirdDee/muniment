/**
 * Muniment data contract, version 1. The authoritative description is arkiv/schema.md; this file is
 * its executable form. Everything read from Arkiv is untrusted input: anyone can write entities that
 * carry the Muniment namespace, so validation here only proves *shape*, never authorship.
 */

export const APP = "muniment-archive"
export const SCHEMA_VERSION = 1

export const KINDS = ["reply", "appeal", "exemption", "receipt", "review"] as const
export type Kind = (typeof KINDS)[number]

export const OUTCOMES = ["granted", "partial", "denied", "transferred", "no-reply"] as const
export type Outcome = (typeof OUTCOMES)[number]

export const OUTCOME_LABELS: Record<Outcome, string> = {
  granted: "Information supplied",
  partial: "Partly supplied",
  denied: "Refused",
  transferred: "Transferred to another office",
  "no-reply": "No reply recorded",
}

export const APPEAL_STAGES = ["first-appeal", "second-appeal"] as const
export type AppealStage = (typeof APPEAL_STAGES)[number]

export const APPEAL_OUTCOMES = ["pending", "allowed", "dismissed", "remanded"] as const
export type AppealOutcome = (typeof APPEAL_OUTCOMES)[number]

export const REVIEW_STATUSES = ["source-compared", "disputed"] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

/** Status a reader derives for a reply. Never stored as a self-declared attribute. */
export type DerivedStatus = "unreviewed" | "source-compared" | "disputed" | "superseded"

/** Payload byte ceilings Muniment enforces on read and write (the protocol allows 128 KiB). */
export const LIMITS = {
  payloadBytes: 64 * 1024,
  title: 200,
  question: 8_000,
  answer: 20_000,
  reference: 120,
  reason: 2_000,
  method: 2_000,
  url: 500,
  exemptions: 8,
} as const

export type Hex = `0x${string}`

/** An attribute as Muniment sees it, independent of whether it came from the SDK or raw JSON-RPC. */
export type AttrValue =
  | { type: "str"; value: string }
  | { type: "i32"; value: number }
  | { type: "u64" | "u256"; value: bigint }
  | { type: "bool"; value: boolean }
  | { type: "addr" | "key" | "bytes32"; value: string }
  | { type: "dec"; value: string }

/** The normalised entity shape every decoder accepts. Fields are optional because queries project. */
export type RawEntity = {
  key: Hex
  owner?: Hex
  creator?: Hex
  createdAt?: bigint
  updatedAt?: bigint
  expiresAt?: bigint
  creationFlags?: { readonly: boolean; permissionlessExtension: boolean }
  contentType?: string
  payload?: Uint8Array
  attributes: Record<string, AttrValue>
}

export type ChainMeta = {
  key: Hex
  creator: Hex | null
  owner: Hex | null
  createdAtBlock: bigint | null
  expiresAtBlock: bigint | null
  readonly: boolean | null
  permissionlessExtension: boolean | null
}

export type ClaimedSource = {
  reference: string
  url: string | null
  documentDate: string | null
  /** What a reader can do with the source. Synthetic fixtures have no live source. */
  status: "synthetic-no-source" | "url-claimed" | "unavailable"
}

export type ReplyPayload = {
  schema: "muniment.reply/1"
  synthetic: true
  title: string
  question: string
  answer: string | null
  authorityName: string
  jurisdictionName: string
  claimedSource: ClaimedSource
  attachment: { label: string; url: string; sha256: string | null } | null
  exemptions: string[]
  correction: { of: Hex; reason: string } | null
  disclosure: string
}

export type Reply = ChainMeta & {
  kind: "reply"
  authority: string
  jurisdiction: string
  topic: string
  outcome: Outcome
  language: string
  filedMs: number
  repliedMs: number | null
  responseDays: number | null
  exemption: string | null
  reference: string
  corrects: Hex | null
  payload: ReplyPayload
}

export type AppealPayload = {
  schema: "muniment.appeal/1"
  synthetic: true
  grounds: string
  decision: string | null
  disclosure: string
}

export type Appeal = ChainMeta & {
  kind: "appeal"
  reply: Hex
  stage: AppealStage
  filedMs: number
  outcome: AppealOutcome
  payload: AppealPayload
}

export type Exemption = ChainMeta & {
  kind: "exemption"
  reply: Hex
  section: string
}

export type ReceiptPayload = {
  schema: "muniment.receipt/1"
  note: string
  /** Number of entities the renewer extended in the same transaction (reply + linked records). */
  extendedCount: number
}

export type Receipt = ChainMeta & {
  kind: "receipt"
  reply: Hex
  targetExpiry: bigint
  payload: ReceiptPayload | null
}

export type ReviewPayload = {
  schema: "muniment.review/1"
  method: string
  limitations: string
  evidenceRef: string | null
  observedAt: string
}

export type Review = ChainMeta & {
  kind: "review"
  reply: Hex
  status: ReviewStatus
  payload: ReviewPayload
}

export type AnyRecord = Reply | Appeal | Exemption | Receipt | Review

export type DecodeIssue = { key: Hex; reason: string }

export type DecodeResult<T> = { ok: true; value: T } | { ok: false; issue: DecodeIssue }

// ---------------------------------------------------------------------------------------------
// Validation helpers. Hand-written so the contract has no runtime dependency beyond the SDK.
// ---------------------------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KEY_RE = /^0x[0-9a-f]{64}$/
const SECTION_RE = /^[0-9]{1,2}(\([0-9a-z]{1,4}\)){0,3}$/

export function isEntityKey(value: unknown): value is Hex {
  return typeof value === "string" && KEY_RE.test(value.toLowerCase())
}

export function isValidSection(value: unknown): value is string {
  return typeof value === "string" && SECTION_RE.test(value)
}

/** Only https URLs without credentials are ever rendered as links. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > LIMITS.url) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

class Invalid extends Error {}

function fail(reason: string): never {
  throw new Invalid(reason)
}

function str(v: unknown, name: string, max: number): string {
  if (typeof v !== "string") fail(`${name} must be a string`)
  if (v.length === 0) fail(`${name} is empty`)
  if (v.length > max) fail(`${name} exceeds ${max} characters`)
  return v
}

function optStr(v: unknown, name: string, max: number): string | null {
  if (v === null || v === undefined) return null
  return str(v, name, max)
}

function oneOf<T extends readonly string[]>(v: unknown, list: T, name: string): T[number] {
  if (typeof v !== "string" || !(list as readonly string[]).includes(v)) {
    fail(`${name} must be one of ${list.join(", ")}`)
  }
  return v as T[number]
}

function attr(e: RawEntity, name: string, type: AttrValue["type"]): AttrValue | undefined {
  const a = e.attributes[name]
  if (a === undefined) return undefined
  if (a.type !== type) fail(`attribute ${name} has type ${a.type}, expected ${type}`)
  return a
}

function reqStr(e: RawEntity, name: string): string {
  const a = attr(e, name, "str")
  if (!a) fail(`missing attribute ${name}`)
  return a.value as string
}

function optU64(e: RawEntity, name: string): bigint | null {
  const a = attr(e, name, "u64")
  return a ? (a.value as bigint) : null
}

function reqU64(e: RawEntity, name: string): bigint {
  const v = optU64(e, name)
  if (v === null) fail(`missing attribute ${name}`)
  return v
}

function optI32(e: RawEntity, name: string): number | null {
  const a = attr(e, name, "i32")
  return a ? (a.value as number) : null
}

function reqKey(e: RawEntity, name: string): Hex {
  const a = attr(e, name, "key")
  if (!a) fail(`missing attribute ${name}`)
  const v = (a.value as string).toLowerCase()
  if (!KEY_RE.test(v)) fail(`attribute ${name} is not an entity key`)
  return v as Hex
}

function optKey(e: RawEntity, name: string): Hex | null {
  return e.attributes[name] ? reqKey(e, name) : null
}

function msToNumber(v: bigint, name: string): number {
  if (v > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${name} is out of range`)
  return Number(v)
}

function decodeJson(e: RawEntity): Record<string, unknown> {
  if (!e.payload) fail("payload was not selected or is missing")
  if (e.payload.byteLength > LIMITS.payloadBytes) fail("payload exceeds Muniment's size limit")
  if (e.contentType !== undefined && e.contentType !== "application/json") {
    fail(`unexpected content type ${e.contentType}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(e.payload))
  } catch {
    fail("payload is not valid UTF-8 JSON")
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail("payload is not a JSON object")
  }
  return parsed as Record<string, unknown>
}

function meta(e: RawEntity): ChainMeta {
  return {
    key: e.key.toLowerCase() as Hex,
    creator: (e.creator ?? null) as Hex | null,
    owner: (e.owner ?? null) as Hex | null,
    createdAtBlock: e.createdAt ?? null,
    expiresAtBlock: e.expiresAt ?? null,
    readonly: e.creationFlags?.readonly ?? null,
    permissionlessExtension: e.creationFlags?.permissionlessExtension ?? null,
  }
}

function checkNamespace(e: RawEntity, kind: Kind): void {
  if (reqStr(e, "app") !== APP) fail("not a Muniment entity")
  const v = optI32(e, "schema")
  if (v === null) fail("missing schema version")
  if (v !== SCHEMA_VERSION) fail(`unsupported schema version ${v}`)
  if (reqStr(e, "kind") !== kind) fail(`expected kind ${kind}`)
}

function wrap<T>(e: RawEntity, fn: () => T): DecodeResult<T> {
  try {
    return { ok: true, value: fn() }
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, issue: { key: e.key, reason: err.message } }
    throw err
  }
}

/** True when an entity declares a schema version this library does not understand. */
export function isUnsupportedVersion(e: RawEntity): boolean {
  const v = e.attributes.schema
  return v !== undefined && v.type === "i32" && v.value !== SCHEMA_VERSION
}

export function decodeReply(e: RawEntity): DecodeResult<Reply> {
  return wrap(e, () => {
    checkNamespace(e, "reply")
    const synthetic = attr(e, "synthetic", "bool")
    if (!synthetic || synthetic.value !== true) fail("record is not marked synthetic")
    const outcome = oneOf(reqStr(e, "outcome"), OUTCOMES, "outcome")
    const filedMs = msToNumber(reqU64(e, "filed_ms"), "filed_ms")
    const repliedRaw = optU64(e, "replied_ms")
    const repliedMs = repliedRaw === null ? null : msToNumber(repliedRaw, "replied_ms")
    const responseDays = optI32(e, "response_days")
    if (outcome === "no-reply" && (repliedMs !== null || responseDays !== null)) {
      fail("a no-reply record cannot carry a reply date or response duration")
    }
    if (repliedMs !== null && repliedMs < filedMs) fail("reply date precedes filing date")
    if (responseDays !== null && (responseDays < 0 || responseDays > 3650)) {
      fail("response_days out of range")
    }
    // Whole elapsed UTC days; missing measurements remain valid, contradictory measurements do not.
    if (repliedMs !== null && responseDays !== null && responseDays !== Math.floor((repliedMs - filedMs) / 86_400_000)) {
      fail("response_days disagrees with filing and reply dates (whole elapsed UTC days)")
    }
    const exemptionAttr = attr(e, "exemption", "str")
    const exemption = exemptionAttr ? (exemptionAttr.value as string) : null
    if (exemption !== null && !isValidSection(exemption)) fail("exemption section is malformed")

    const p = decodeJson(e)
    if (p.schema !== "muniment.reply/1") fail("payload schema mismatch")
    if (p.synthetic !== true) fail("payload is not marked synthetic")
    const cs = (p.claimedSource ?? {}) as Record<string, unknown>
    const documentDate = optStr(cs.documentDate, "claimedSource.documentDate", 10)
    if (documentDate !== null && !DATE_RE.test(documentDate)) fail("documentDate must be YYYY-MM-DD")
    const exemptions = Array.isArray(p.exemptions) ? p.exemptions : fail("exemptions must be a list")
    if (exemptions.length > LIMITS.exemptions) fail("too many exemption sections")
    for (const s of exemptions) if (!isValidSection(s)) fail("exemption section is malformed")
    let correction: ReplyPayload["correction"] = null
    if (p.correction !== null && p.correction !== undefined) {
      const c = p.correction as Record<string, unknown>
      if (!isEntityKey(c.of)) fail("correction.of is not an entity key")
      correction = { of: (c.of as string).toLowerCase() as Hex, reason: str(c.reason, "correction.reason", LIMITS.reason) }
    }
    let attachment: ReplyPayload["attachment"] = null
    if (p.attachment !== null && p.attachment !== undefined) {
      const a = p.attachment as Record<string, unknown>
      const url = safeUrl(a.url)
      if (!url) fail("attachment url is not a safe https URL")
      attachment = {
        label: str(a.label, "attachment.label", 120),
        url,
        sha256: optStr(a.sha256, "attachment.sha256", 64),
      }
    }
    const answer = p.answer === null ? null : str(p.answer, "answer", LIMITS.answer)
    if (outcome === "no-reply" && answer !== null) fail("a no-reply record cannot carry an answer")
    const corrects = optKey(e, "corrects")
    if ((corrects === null) !== (correction === null)) fail("correction attribute and payload disagree")
    if (corrects !== null && correction !== null && corrects !== correction.of) {
      fail("correction attribute and payload point at different records")
    }
    const sourceUrl = cs.url === null || cs.url === undefined ? null : safeUrl(cs.url)
    if (cs.url && !sourceUrl) fail("claimed source url is not a safe https URL")

    const payload: ReplyPayload = {
      schema: "muniment.reply/1",
      synthetic: true,
      title: str(p.title, "title", LIMITS.title),
      question: str(p.question, "question", LIMITS.question),
      answer,
      authorityName: str(p.authorityName, "authorityName", 160),
      jurisdictionName: str(p.jurisdictionName, "jurisdictionName", 160),
      claimedSource: {
        reference: str(cs.reference, "claimedSource.reference", LIMITS.reference),
        url: sourceUrl,
        documentDate,
        status: oneOf(cs.status, ["synthetic-no-source", "url-claimed", "unavailable"] as const, "claimedSource.status"),
      },
      attachment,
      exemptions: exemptions as string[],
      correction,
      disclosure: str(p.disclosure, "disclosure", 600),
    }
    return {
      ...meta(e),
      kind: "reply" as const,
      authority: reqStr(e, "authority"),
      jurisdiction: reqStr(e, "jurisdiction"),
      topic: reqStr(e, "topic"),
      outcome,
      language: reqStr(e, "language"),
      filedMs,
      repliedMs,
      responseDays,
      exemption,
      reference: reqStr(e, "ref"),
      corrects,
      payload,
    }
  })
}

export function decodeAppeal(e: RawEntity): DecodeResult<Appeal> {
  return wrap(e, () => {
    checkNamespace(e, "appeal")
    const p = decodeJson(e)
    if (p.schema !== "muniment.appeal/1") fail("payload schema mismatch")
    if (p.synthetic !== true) fail("payload is not marked synthetic")
    return {
      ...meta(e),
      kind: "appeal" as const,
      reply: reqKey(e, "reply"),
      stage: oneOf(reqStr(e, "stage"), APPEAL_STAGES, "stage"),
      filedMs: msToNumber(reqU64(e, "filed_ms"), "filed_ms"),
      outcome: oneOf(reqStr(e, "outcome"), APPEAL_OUTCOMES, "outcome"),
      payload: {
        schema: "muniment.appeal/1",
        synthetic: true,
        grounds: str(p.grounds, "grounds", LIMITS.reason),
        decision: optStr(p.decision, "decision", LIMITS.reason),
        disclosure: str(p.disclosure, "disclosure", 600),
      },
    }
  })
}

export function decodeExemption(e: RawEntity): DecodeResult<Exemption> {
  return wrap(e, () => {
    checkNamespace(e, "exemption")
    const section = reqStr(e, "section")
    if (!isValidSection(section)) fail("section is malformed")
    return { ...meta(e), kind: "exemption" as const, reply: reqKey(e, "reply"), section }
  })
}

export function decodeReceipt(e: RawEntity): DecodeResult<Receipt> {
  return wrap(e, () => {
    checkNamespace(e, "receipt")
    let payload: ReceiptPayload | null = null
    if (e.payload && e.payload.byteLength > 0) {
      const p = decodeJson(e)
      if (p.schema === "muniment.receipt/1") {
        const count = typeof p.extendedCount === "number" && Number.isInteger(p.extendedCount) ? p.extendedCount : 0
        payload = { schema: "muniment.receipt/1", note: optStr(p.note, "note", 280) ?? "", extendedCount: count }
      }
    }
    return {
      ...meta(e),
      kind: "receipt" as const,
      reply: reqKey(e, "reply"),
      targetExpiry: reqU64(e, "target_expiry"),
      payload,
    }
  })
}

export function decodeReview(e: RawEntity): DecodeResult<Review> {
  return wrap(e, () => {
    checkNamespace(e, "review")
    const p = decodeJson(e)
    if (p.schema !== "muniment.review/1") fail("payload schema mismatch")
    return {
      ...meta(e),
      kind: "review" as const,
      reply: reqKey(e, "reply"),
      status: oneOf(reqStr(e, "status"), REVIEW_STATUSES, "status"),
      payload: {
        schema: "muniment.review/1",
        method: str(p.method, "method", LIMITS.method),
        limitations: str(p.limitations, "limitations", LIMITS.method),
        evidenceRef: optStr(p.evidenceRef, "evidenceRef", LIMITS.url),
        observedAt: str(p.observedAt, "observedAt", 40),
      },
    }
  })
}

export function kindOf(e: RawEntity): Kind | null {
  const k = e.attributes.kind
  if (!k || k.type !== "str") return null
  return (KINDS as readonly string[]).includes(k.value) ? (k.value as Kind) : null
}

export function decodeAny(e: RawEntity): DecodeResult<AnyRecord> {
  switch (kindOf(e)) {
    case "reply":
      return decodeReply(e)
    case "appeal":
      return decodeAppeal(e)
    case "exemption":
      return decodeExemption(e)
    case "receipt":
      return decodeReceipt(e)
    case "review":
      return decodeReview(e)
    default:
      return { ok: false, issue: { key: e.key, reason: "unknown kind" } }
  }
}
