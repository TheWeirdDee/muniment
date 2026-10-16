/** Real Tiramisu controls for concurrent renewal and current balances. Never touches archive records. */
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk"
import { str } from "@arkiv-network/sdk/attr"
import { formatEther } from "viem"
import { Evidence, address, errorText, publicClient, wallet, type Role } from "./lib.js"

const ev = new Evidence("resilience")
async function main() {
  const chainId = await publicClient.getChainId()
  if (chainId !== 7738577) throw new Error(`Wrong chain: ${chainId}`)
  const balances: Record<string, unknown> = {}
  for (const role of ["PUBLISHER", "RENEWER", "REVIEWER", "STRANGER"] as Role[]) {
    const balance = await publicClient.getBalance({ address: address(role) })
    balances[role] = { address: address(role), wei: String(balance), GLM: formatEther(balance) }
    if (balance < 10n ** 16n) throw new Error(`${role} has less than 0.01 test GLM; no transactions sent`)
  }
  ev.record({ id: "R0", title: "Current balances and chain", expected: "Tiramisu only; funded test wallets", observed: JSON.stringify({ chainId, balances }), outcome: "pass", data: { chainId, balances } })
  const control = await wallet("PUBLISHER").createEntity({
    payload: jsonToPayload({ synthetic: true, control: "concurrent-renewal", note: "Not an archive reply" }),
    contentType: "application/json", attributes: { app: str("muniment-archive"), kind: str("control"), label: str("concurrent-renewal") },
    expires: ExpirationTime.fromHours(1), flags: { readonly: true, permissionlessExtension: true },
  })
  const before = await publicClient.getEntity(control.entityKey)
  const target = before.expiresAt + 3600n
  // Both wallets see the same snapshot and submit the same absolute target. The engine may accept
  // an equal target as a no-op; never assume a successful transaction adds time twice.
  const results = await Promise.allSettled((["RENEWER", "STRANGER"] as Role[]).map((role) =>
    wallet(role).extendEntity({ entityKey: control.entityKey, expires: ExpirationTime.atBlock(target) })))
  const after = await publicClient.getEntity(control.entityKey)
  const outcomes = results.map((r, i) => r.status === "fulfilled"
    ? { role: i === 0 ? "RENEWER" : "STRANGER", status: "fulfilled", txHash: r.value.txHash }
    : { role: i === 0 ? "RENEWER" : "STRANGER", status: "rejected", error: errorText(r.reason) })
  const won = results.filter((r) => r.status === "fulfilled").length
  const lost = results.find((r) => r.status === "rejected")
  const expectedRejection = lost?.status === "rejected" && /ExpiryNotExtended|expiry.*extend/i.test(String(lost.reason))
  ev.record({ id: "R1", title: "Two wallets concurrently renew from the same expiry snapshot", expected: "at least one success; any rejection is ExpiryNotExtended; exact absolute target read back, never double coverage; old snapshot is stale", observed: JSON.stringify({ before: String(before.expiresAt), target: String(target), after: String(after.expiresAt), outcomes }), outcome: (won === 2 || won === 1 && expectedRejection) && after.expiresAt === target && after.expiresAt > before.expiresAt ? "pass" : "fail", txHashes: [control.txHash, ...outcomes.flatMap((r) => r.txHash ? [r.txHash] : [])], entityKeys: [control.entityKey], data: { outcomes } })
  ev.save()
  process.exitCode = ev.items.some((i) => i.outcome !== "pass") ? 1 : 0
}
main().catch((e) => { ev.record({ id: "ABORT", title: "Resilience campaign interrupted", expected: "complete run", observed: errorText(e), outcome: "blocked" }); ev.save(); process.exitCode = 1 })
