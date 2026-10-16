/**
 * Independently verify every Muniment renewal receipt created by a given transaction.
 *   node --import tsx scripts/verify-tx.ts <txHash>
 */
import { ARKIV_ADDRESS, ENTITY_CREATED_TOPIC, decodeReceipt, fromSdkEntity, FULL_SELECT, verifyRenewalReceipt, type ArchiveClient } from "muniment-query"
import { publicClient } from "./lib.js"

const tx = process.argv[2] as `0x${string}`
const rcpt = await publicClient.getTransactionReceipt({ hash: tx })
const created = rcpt.logs.filter((l) => l.address.toLowerCase() === ARKIV_ADDRESS.toLowerCase() && l.topics[0] === ENTITY_CREATED_TOPIC).map((l) => l.topics[1] as `0x${string}`)
for (const key of created) {
  const res = await publicClient.query(`$key = key(${key})`, { select: FULL_SELECT, limit: 1 })
  const d = res.entities[0] ? decodeReceipt(fromSdkEntity(res.entities[0] as never)) : null
  if (!d || !d.ok) {
    console.log(key, "not a receipt or not readable")
    continue
  }
  console.log(key, JSON.stringify(await verifyRenewalReceipt(publicClient as unknown as ArchiveClient, d.value), (_k, v) => (typeof v === "bigint" ? v.toString() : v)))
}
