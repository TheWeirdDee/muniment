import { ARKIV_ADDRESS, ENTITY_CREATED_TOPIC, type Hex } from "muniment-query"
import { publicClient } from "./arkiv"
import { TransactionReceiptNotFoundError } from "viem"

/** Read-only recovery: a missing receipt is unknown, never permission to rebroadcast. */
export async function submittedResult(hash: Hex) {
  let receipt
  try { receipt = await publicClient().getTransactionReceipt({ hash }) }
  catch (err) { if (err instanceof TransactionReceiptNotFoundError) return null; throw err }
  if (!receipt) return null
  if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase() || receipt.to?.toLowerCase() !== ARKIV_ADDRESS.toLowerCase()) throw new Error("Unexpected transaction receipt")
  if (receipt.status === "reverted") return { state: "reverted" as const }
  if (receipt.status !== "success") return null
  const created = receipt.logs.filter(log => log.address.toLowerCase() === ARKIV_ADDRESS.toLowerCase() && log.topics[0] === ENTITY_CREATED_TOPIC)
    .map(log => log.topics[1]).filter((key): key is Hex => !!key)
  return { state: "confirmed" as const, created }
}
