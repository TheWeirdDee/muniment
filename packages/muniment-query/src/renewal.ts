/**
 * Renewal planning. Pure functions: given fresh chain state, decide what a renewing wallet may extend,
 * to which block, and how the work splits into atomic batches. Lifetime Extension *sets* an absolute
 * expiry and reverts if it is not later, so a plan never targets a record that already lives longer.
 */
import { APP, type Hex, SCHEMA_VERSION } from "./schema.js"
import type { WireAttr, WireCreate, WireExtend } from "./encode.js"

export type RenewalCandidate = {
  key: Hex
  kind: "reply" | "appeal" | "exemption"
  /** The reply this record belongs to (itself, for a reply). */
  reply: Hex
  expiresAtBlock: bigint | null
  permissionlessExtension: boolean | null
  owner: Hex | null
}

export type PlanAction =
  | { action: "extend" }
  | { action: "already-covered"; detail: string }
  | { action: "not-permitted"; detail: string }
  | { action: "expired"; detail: string }
  | { action: "unknown"; detail: string }

export type PlannedItem = RenewalCandidate & PlanAction

export type RenewalUnit = {
  reply: Hex
  items: PlannedItem[]
  /** Extensions plus the receipt create. Zero when the reply itself needs no extension. */
  operations: number
}

export type RenewalPlan = {
  targetBlock: bigint
  headBlock: bigint
  units: RenewalUnit[]
  /** Each inner array is one atomic transaction. */
  batches: RenewalUnit[][]
  extendCount: number
  skipped: PlannedItem[]
}

export const DEFAULT_MAX_OPS_PER_BATCH = 24

/** Smallest lifetime Muniment will submit, so a quote cannot land dead on arrival. */
export const MIN_HEADROOM_BLOCKS = 150n

export function classify(c: RenewalCandidate, renewer: Hex, targetBlock: bigint, headBlock: bigint): PlannedItem {
  if (c.expiresAtBlock === null || c.permissionlessExtension === null) {
    return { ...c, action: "unknown", detail: "current state could not be read" }
  }
  if (c.expiresAtBlock <= headBlock) {
    return { ...c, action: "expired", detail: "already past its expiry block; it cannot be renewed" }
  }
  if (c.expiresAtBlock >= targetBlock) {
    return { ...c, action: "already-covered", detail: "already lives at least as long as the target" }
  }
  const isOwner = c.owner !== null && c.owner.toLowerCase() === renewer.toLowerCase()
  if (!c.permissionlessExtension && !isOwner) {
    return { ...c, action: "not-permitted", detail: "created without permissionless extension" }
  }
  return { ...c, action: "extend" }
}

export function planRenewal(
  candidates: readonly RenewalCandidate[],
  opts: { renewer: Hex; targetBlock: bigint; headBlock: bigint; maxOpsPerBatch?: number },
): RenewalPlan {
  const max = opts.maxOpsPerBatch ?? DEFAULT_MAX_OPS_PER_BATCH
  if (opts.targetBlock <= opts.headBlock + MIN_HEADROOM_BLOCKS) {
    throw new Error("target expiry is too close to the current block")
  }
  const seen = new Set<string>()
  const byReply = new Map<Hex, PlannedItem[]>()
  for (const c of candidates) {
    const k = c.key.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    const item = classify(c, opts.renewer, opts.targetBlock, opts.headBlock)
    const list = byReply.get(c.reply) ?? []
    list.push(item)
    byReply.set(c.reply, list)
  }
  const units: RenewalUnit[] = []
  const skipped: PlannedItem[] = []
  for (const [reply, items] of byReply) {
    const replyItem = items.find((i) => i.key === reply && i.kind === "reply")
    // Linked records only travel with their reply. Without a renewable reply, nothing in the unit is
    // submitted, so a receipt is never written for a reply that was not extended.
    if (!replyItem || replyItem.action !== "extend") {
      skipped.push(...items)
      continue
    }
    const extend = items.filter((i) => i.action === "extend")
    skipped.push(...items.filter((i) => i.action !== "extend"))
    const ops = extend.length + 1
    if (ops > max) throw new Error(`reply ${reply} needs ${ops} operations, above the batch limit of ${max}`)
    units.push({ reply, items: extend, operations: ops })
  }
  const batches: RenewalUnit[][] = []
  let current: RenewalUnit[] = []
  let size = 0
  for (const u of units) {
    if (size + u.operations > max && current.length > 0) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(u)
    size += u.operations
  }
  if (current.length > 0) batches.push(current)
  return {
    targetBlock: opts.targetBlock,
    headBlock: opts.headBlock,
    units,
    batches,
    extendCount: units.reduce((n, u) => n + u.items.length, 0),
    skipped,
  }
}

export const RECEIPT_CONTENT_TYPE = "application/json"

export function receiptPayload(extendedCount: number): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      schema: "muniment.receipt/1",
      note: "Renewal claim. Verify it against the creating transaction before counting it.",
      extendedCount,
    }),
  )
}

/** Receipt attributes in wire form (used for gas estimation). */
export function receiptWireAttributes(reply: Hex, targetBlock: bigint): WireAttr[] {
  return [
    { name: "app", type: "str", value: APP },
    { name: "schema", type: "i32", value: SCHEMA_VERSION },
    { name: "kind", type: "str", value: "receipt" },
    { name: "reply", type: "key", value: reply },
    { name: "target_expiry", type: "u64", value: targetBlock },
  ]
}

/** Wire-form operations for one batch, matching what the app sends through the SDK. */
export function batchToWire(batch: RenewalUnit[], targetBlock: bigint, salt: (i: number) => bigint) {
  const creates: WireCreate[] = batch.map((u, i) => ({
    salt: salt(i),
    expiresAt: targetBlock,
    minLifetime: 0n,
    flags: { readonly: true, permissionlessExtension: false },
    payload: receiptPayload(u.items.length),
    contentType: RECEIPT_CONTENT_TYPE,
    attributes: receiptWireAttributes(u.reply, targetBlock),
  }))
  const extensions: WireExtend[] = batch.flatMap((u) =>
    u.items.map((it) => ({ entityKey: it.key, expiresAt: targetBlock, minLifetime: 0n })),
  )
  return { creates, extensions }
}

/** Itemised estimate in the chain's native unit (wei of test GLM). Never converted to fiat. */
export type CostEstimate = {
  gas: bigint
  gasPriceWei: bigint
  totalWei: bigint
}

export function estimateCost(gas: bigint, gasPriceWei: bigint, safetyNumerator = 12n, safetyDenominator = 10n): CostEstimate {
  const padded = (gas * safetyNumerator) / safetyDenominator
  return { gas: padded, gasPriceWei, totalWei: padded * gasPriceWei }
}

export function formatGlm(wei: bigint, digits = 6): string {
  const neg = wei < 0n
  const v = neg ? -wei : wei
  const whole = v / 10n ** 18n
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "")
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`
}
