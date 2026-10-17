import type { Hex, Receipt, RenewalUnit, VerificationState } from "muniment-query"

export type ReplyReconciliation = {
  reply: Hex
  receipt?: Hex
  state: "verified" | "pending" | "unverified"
  reason: string
}
export type BatchReconciliation = { state: ReplyReconciliation["state"]; replies: ReplyReconciliation[] }
export type ReconciliationReads = {
  receipt(key: Hex): Promise<Receipt | null>
  verify(receipt: Receipt): Promise<VerificationState>
  expiry(key: Hex): Promise<bigint | null>
}
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Match by receipt attributes, never SDK result order; verify the entire reviewed extension set. */
export async function reconcileBatch(
  batch: RenewalUnit[], target: bigint, tx: Hex, renewer: Hex, created: Hex[], reads: ReconciliationReads,
): Promise<BatchReconciliation> {
  const loaded = await Promise.all(created.map(async key => {
    try { return { key, receipt: await reads.receipt(key) } }
    catch { return { key, receipt: null } }
  }))
  const expectedKeys = new Set(batch.flatMap(u => u.items.map(i => i.key.toLowerCase())))
  const invalidShape = created.length !== batch.length || new Set(created.map(k => k.toLowerCase())).size !== created.length
  const replies = await Promise.all(batch.map(async (unit): Promise<ReplyReconciliation> => {
    const result = (state: ReplyReconciliation["state"], reason: string, receipt?: Hex): ReplyReconciliation => ({ reply: unit.reply, state, reason, receipt })
    if (invalidShape) return result("unverified", "Confirmed transaction returned an unexpected receipt count or duplicate receipt keys.")
    if (loaded.some(r => r.receipt && !batch.some(u => same(u.reply, r.receipt!.reply)))) {
      return result("unverified", "A created receipt names a reply outside the reviewed plan.")
    }
    const matches = loaded.filter(r => r.receipt && same(r.receipt.reply, unit.reply))
    if (matches.length === 0 && loaded.some(r => r.receipt === null)) return result("pending", "Receipt for this reply is not readable yet. Recheck without signing again.")
    if (matches.length !== 1) return result("unverified", "Expected exactly one created receipt for this reply.")
    const { key, receipt } = matches[0]
    if (!receipt || !same(receipt.key, key) || receipt.targetExpiry !== target || !receipt.creator || !same(receipt.creator, renewer)
      || receipt.payload?.extendedCount !== unit.items.length) {
      return result("unverified", "Receipt key, target or publisher does not match the confirmed plan.", key)
    }
    try {
      const checked = await reads.verify(receipt)
      if (checked.state !== "verified") return result(checked.state === "unknown" ? "pending" : "unverified", checked.reason, key)
      if (!same(checked.txHash, tx) || !same(checked.renewer, renewer)) {
        return result("unverified", "Receipt belongs to a different transaction or renewing wallet.", key)
      }
      if (checked.extended.length !== expectedKeys.size || checked.extended.some(e => !expectedKeys.has(e.key.toLowerCase()) || e.expiresAt !== target)
        || new Set(checked.extended.map(e => e.key.toLowerCase())).size !== expectedKeys.size) {
        return result("unverified", "Confirmed extension events do not exactly match every entity and target in the reviewed batch.", key)
      }
      for (const item of unit.items) {
        const expiry = await reads.expiry(item.key)
        if (expiry === null || expiry < target) return result("pending", `Current expiry for ${item.key} has not reached the target on this endpoint.`, key)
      }
      return result("verified", "Receipt, transaction events and every planned entity expiry reconciled.", key)
    } catch {
      return result("pending", "Confirmed on chain; verification reads are delayed. Recheck without signing again.", key)
    }
  }))
  return { state: replies.length > 0 && replies.every(r => r.state === "verified") ? "verified" : replies.some(r => r.state === "unverified") ? "unverified" : "pending", replies }
}
