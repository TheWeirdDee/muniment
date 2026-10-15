import { ExpirationTime } from "@arkiv-network/sdk"
import { i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import {
  APP,
  ARKIV_ADDRESS,
  BLOCKS_PER_DAY,
  type CostEstimate,
  type Hex,
  type RenewalCandidate,
  type RenewalPlan,
  type RenewalUnit,
  type Reply,
  SCHEMA_VERSION,
  SEAL_ADDRESS,
  type VerificationState,
  batchToWire,
  decodeReceipt,
  encodeExecute,
  estimateCost,
  fromSdkEntity,
  planRenewal,
  receiptPayload,
  verifyRenewalReceipt,
  FULL_SELECT,
  clearReadCache,
} from "muniment-query"
import { publicClient, reader } from "./arkiv"

export const COVERAGE_OPTIONS = [
  { days: 30, label: "30 days from now" },
  { days: 90, label: "90 days from now" },
  { days: 180, label: "180 days from now" },
  { days: 365, label: "1 year from now" },
] as const

export type Discovery = {
  headBlock: bigint
  replies: Reply[]
  missing: Hex[]
  candidates: RenewalCandidate[]
  /** Linked lists that hit a page bound; newly added appeals may also appear after this snapshot. */
  incompleteLinks: Hex[]
}

/** Fetch fresh chain state for the selected replies and every linked appeal/exemption. */
export async function discover(keys: Hex[], signal?: AbortSignal): Promise<Discovery> {
  clearReadCache()
  const r = reader()
  const head = await publicClient().getBlockNumber()
  const { records } = await r.getReplies(keys, signal)
  const found = new Set(records.map((x) => x.key))
  const candidates: RenewalCandidate[] = []
  const incompleteLinks: Hex[] = []
  for (const reply of records) {
    candidates.push({ key: reply.key, kind: "reply", reply: reply.key, expiresAtBlock: reply.expiresAtBlock, permissionlessExtension: reply.permissionlessExtension, owner: reply.owner })
    const linked = await r.getLinked(reply.key, signal)
    if (!linked.complete) incompleteLinks.push(reply.key)
    // Only records created by the reply's own creator travel with it: a stranger's appeal cannot be
    // bundled into someone else's preservation without their review.
    for (const a of linked.appeals) {
      if (a.creator?.toLowerCase() !== reply.creator?.toLowerCase()) continue
      candidates.push({ key: a.key, kind: "appeal", reply: reply.key, expiresAtBlock: a.expiresAtBlock, permissionlessExtension: a.permissionlessExtension, owner: a.owner })
    }
    for (const x of linked.exemptions) {
      if (x.creator?.toLowerCase() !== reply.creator?.toLowerCase()) continue
      candidates.push({ key: x.key, kind: "exemption", reply: reply.key, expiresAtBlock: x.expiresAtBlock, permissionlessExtension: x.permissionlessExtension, owner: x.owner })
    }
  }
  return { headBlock: head, replies: records, missing: keys.filter((k) => !found.has(k)), candidates, incompleteLinks }
}

export function targetBlockFor(headBlock: bigint, days: number): bigint {
  return headBlock + BigInt(days * BLOCKS_PER_DAY)
}

export type Quote = {
  plan: RenewalPlan
  perBatch: CostEstimate[]
  totalWei: bigint
  estimatedFrom: Hex
  createdAtMs: number
  snapshot: Record<string, string>
}

const randomSalt = () => {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return b.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n)
}

export async function quote(d: Discovery, opts: { renewer: Hex | null; days: number }): Promise<Quote> {
  const target = targetBlockFor(d.headBlock, opts.days)
  const renewer = opts.renewer ?? (SEAL_ADDRESS as Hex)
  const plan = planRenewal(d.candidates, { renewer, targetBlock: target, headBlock: d.headBlock })
  const client = publicClient()
  const rpc = client as unknown as { request(a: { method: string; params?: unknown[] }): Promise<string> }
  const gasPrice = BigInt(await rpc.request({ method: "eth_gasPrice", params: [] }))
  const perBatch: CostEstimate[] = []
  for (const batch of plan.batches) {
    const wire = batchToWire(batch, target, () => randomSalt())
    const data = encodeExecute(wire)
    const gas = BigInt(await rpc.request({ method: "eth_estimateGas", params: [{ from: renewer, to: ARKIV_ADDRESS, data }] }))
    perBatch.push(estimateCost(gas, gasPrice))
  }
  const snapshot: Record<string, string> = {}
  for (const c of d.candidates) snapshot[c.key] = String(c.expiresAtBlock)
  return { plan, perBatch, totalWei: perBatch.reduce((n, c) => n + c.totalWei, 0n), estimatedFrom: renewer, createdAtMs: Date.now(), snapshot }
}

/** Re-read the entities in a batch and report any whose state moved since the quote. */
export async function staleCheck(batch: RenewalUnit[], q: Quote): Promise<string[]> {
  clearReadCache()
  const client = publicClient()
  const keys = batch.flatMap((u) => u.items.map((i) => i.key))
  const changed: string[] = []
  for (let i = 0; i < keys.length; i += 20) {
    const chunk = keys.slice(i, i + 20)
    const res = await client.query(`${chunk.map((k) => `$key = key(${k})`).join(" OR ")}`, { select: { key: true, expiresAt: true }, limit: 20 })
    const seen = new Map(res.entities.map((e) => [String(e.key).toLowerCase(), String(e.expiresAt)]))
    for (const k of chunk) {
      const now = seen.get(k) ?? "missing"
      if (now !== q.snapshot[k]) changed.push(k)
    }
  }
  return changed
}

export function batchParams(batch: RenewalUnit[], target: bigint) {
  return {
    creates: batch.map((u) => ({
      payload: receiptPayload(u.items.length),
      contentType: "application/json" as const,
      attributes: {
        app: str(APP),
        schema: i32(SCHEMA_VERSION),
        kind: str("receipt"),
        reply: key(u.reply),
        target_expiry: u64(target),
      },
      expires: ExpirationTime.atBlock(target),
      flags: { readonly: true, permissionlessExtension: false },
    })),
    extensions: batch.flatMap((u) => u.items.map((it) => ({ entityKey: it.key, expires: ExpirationTime.atBlock(target) }))),
  }
}

/** Wait (bounded, with backoff) until this client's endpoint reports the new expiry. */
export async function waitForVisibility(replyKey: Hex, target: bigint, timeoutMs = 60_000): Promise<number | null> {
  const start = performance.now()
  let delay = 400
  while (performance.now() - start < timeoutMs) {
    try {
      clearReadCache()
      const e = await publicClient().getEntity(replyKey)
      if (e.expiresAt >= target) return Math.round(performance.now() - start)
    } catch {
      // keep polling until the deadline
    }
    await new Promise((r) => setTimeout(r, delay))
    delay = Math.min(delay * 1.6, 4000)
  }
  return null
}

export async function verifyCreatedReceipt(receiptKey: Hex): Promise<VerificationState> {
  clearReadCache()
  const res = await publicClient().query(`$key = key(${receiptKey})`, { select: FULL_SELECT, limit: 1 })
  const raw = res.entities[0]
  if (!raw) return { state: "unknown", reason: "receipt not yet visible on this endpoint" }
  const d = decodeReceipt(fromSdkEntity(raw as never))
  if (!d.ok) return { state: "unverified", reason: d.issue.reason, txHash: null }
  return verifyRenewalReceipt(publicClient() as never, d.value)
}
