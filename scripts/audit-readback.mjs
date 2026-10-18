/** Read-only campaign recheck, independent of the application's reconciliation code.
 * node scripts/audit-readback.mjs <new-output.json> [campaign.json]
 * No environment file, wallet, signer, send method or automatic quota retry.
 */
import assert from "node:assert/strict"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { decodeEventLog } from "viem"
import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk"
const output = process.argv[2]
if (!output || existsSync(output)) throw new Error("Supply a new output path; historical evidence is never overwritten")
const campaignPath = process.argv[3] ?? "evidence/transactions-2026-10-17/campaign.json"
const campaign = JSON.parse(readFileSync(campaignPath, "utf8"))
const endpoint = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
const registry = "0x4400000000000000000000000000000000000044"
const lower = value => String(value).toLowerCase()
const report = { checkedAt: new Date().toISOString(), endpoint, chainId: null, status: "INCOMPLETE", implementation: "Raw JSON-RPC plus SDK event ABI; no application verifier", sameProvider: true, transactions: [], entities: null }
let id = 0
async function rpc(method, params = []) {
  const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }), signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}; Retry-After=${res.headers.get("retry-after")}; RateLimit=${res.headers.get("ratelimit")}`)
  const body = await res.json()
  if (body.error) throw new Error(JSON.stringify(body.error))
  return body.result
}
try {
  report.chainId = Number(BigInt(await rpc("eth_chainId")))
  assert.equal(report.chainId, 7738577)
  const workflows = [campaign.workflows.publication, campaign.workflows.single, ...(campaign.priorMulti ?? []), campaign.workflows.multi]
  const expectedReceipts = []
  const expiryTargets = new Map()
  for (const w of workflows) {
    assert.equal(w.status, "PASS", "Campaign workflow is incomplete")
    const raw = await rpc("eth_getTransactionReceipt", [w.txHash])
    report.transactions.push({ hash: w.txHash, raw })
    assert.equal(raw.status, "0x1")
    assert.equal(lower(raw.transactionHash), lower(w.txHash))
    assert.equal(lower(raw.to), registry)
    assert.equal(lower(raw.from), lower(w.wallet))
    assert.equal(BigInt(raw.blockNumber), BigInt(w.block))
    const events = raw.logs.filter(log => lower(log.address) === registry).map(log => {
      try { return decodeEventLog({ abi: ENTITY_EVENTS_ABI, topics: log.topics, data: log.data }) } catch { return null }
    }).filter(Boolean)
    const extended = events.filter(e => e.eventName === "ExpiryExtended")
    const created = events.filter(e => e.eventName === "EntityCreated")
    const items = w.review?.entities ?? []
    assert.equal(extended.length, items.length)
    for (const item of items) {
      const matches = extended.filter(e => lower(e.args.entityKey) === lower(item.key) && e.args.expiresAt === BigInt(item.target))
      assert.equal(matches.length, 1, `Exact reviewed extension missing: ${item.key}`)
      const target = BigInt(item.target)
      expiryTargets.set(lower(item.key), target > (expiryTargets.get(lower(item.key)) ?? 0n) ? target : expiryTargets.get(lower(item.key)))
    }
    const receipts = w.independent?.receipts ?? []
    if (w.action !== "publication") {
      assert.equal(receipts.length, w.review.replies.length, "Every reviewed reply must have a receipt")
      assert.equal(new Set(receipts.map(r => lower(r.reply))).size, receipts.length)
      for (const r of receipts) assert.equal(r.extendedCount, items.filter(item => lower(item.reply) === lower(r.reply)).length)
    }
    assert.equal(created.length, w.action === "publication" ? 1 : receipts.length)
    for (const receipt of receipts) {
      assert.equal(created.filter(e => lower(e.args.entityKey) === lower(receipt.key) && lower(e.args.owner) === lower(w.wallet) && e.args.expiresAt === BigInt(receipt.target)).length, 1)
      expectedReceipts.push({ ...receipt, tx: w.txHash, block: w.block })
    }
  }
  assert.equal(expectedReceipts.length, workflows.reduce((n, w) => n + (w.review?.replies.length ?? 0), 0))
  const keys = [...new Set([...expiryTargets.keys(), ...expectedReceipts.map(r => lower(r.key))])]
  const select = { key: true, creator: true, owner: true, createdAt: true, expiresAt: true, creationFlags: true, payload: true, attributes: true }
  report.entities = await rpc("arkiv_query", [keys.map(key => `$key = key(${key})`).join(" OR "), { select, limit: "0x14" }])
  const entities = new Map(report.entities.data.map(e => [lower(e.key), e]))
  for (const r of expectedReceipts) {
    const e = entities.get(lower(r.key)); assert.ok(e)
    const attrs = Object.fromEntries(e.attributes.map(a => [a.name, a.value]))
    assert.equal(attrs.app, "muniment-archive"); assert.equal(attrs.kind, "receipt")
    assert.equal(lower(attrs.reply), lower(r.reply)); assert.equal(BigInt(attrs.target_expiry), BigInt(r.target))
    assert.equal(lower(e.creator), lower(r.creator)); assert.equal(BigInt(e.createdAt), BigInt(r.block))
    const payload = JSON.parse(Buffer.from(e.payload.slice(2), "hex").toString())
    assert.equal(payload.extendedCount, r.extendedCount)
    assert.equal(e.creationFlags.readonly, true)
  }
  for (const [key, target] of expiryTargets) {
    const entity = entities.get(key); assert.ok(entity)
    assert.ok(BigInt(entity.expiresAt) >= target)
    assert.equal(entity.creationFlags.readonly, true)
    assert.equal(entity.creationFlags.permissionlessExtension, true)
    assert.equal(lower(entity.owner), "0x000000000000000000000000000000000000dead")
  }
  report.status = "PASS"
  report.summary = { successfulTransactions: workflows.length, matchingRenewalReceipts: expectedReceipts.length, exactExtensionEvents: workflows.reduce((n, w) => n + (w.review?.entities.length ?? 0), 0), repliesReadBack: expiryTargets.size }
} catch (error) { report.error = error.message; process.exitCode = 1 }
finally { writeFileSync(output, JSON.stringify(report, (_key, value) => typeof value === "bigint" ? String(value) : value, 2) + "\n") }
console.log(JSON.stringify({ status: report.status, summary: report.summary, error: report.error, output }))
