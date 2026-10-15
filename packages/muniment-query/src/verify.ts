/**
 * Renewal attribution. A receipt entity is only a claim: anyone can write one with any attributes.
 * A claim becomes "verified" when chain execution proves that the *same successful transaction*
 * that created the receipt also extended the reply it names, to the expiry it states, and was sent
 * by the wallet the chain records as the receipt's creator.
 */
import { type Hex as ViemHex, decodeEventLog, toEventSelector } from "viem"
import { ARKIV_ADDRESS } from "./network.js"
import type { ArchiveClient } from "./reader.js"
import type { Hex, Receipt } from "./schema.js"

const EVENTS = [
  {
    type: "event",
    name: "EntityCreated",
    inputs: [
      { name: "entityKey", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "expiresAt", type: "uint64", indexed: false },
      { name: "creationFlags", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ExpiryExtended",
    inputs: [
      { name: "entityKey", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "expiresAt", type: "uint64", indexed: false },
    ],
  },
] as const

export const ENTITY_CREATED_TOPIC = toEventSelector("EntityCreated(bytes32,address,uint64,uint8)")
export const EXPIRY_EXTENDED_TOPIC = toEventSelector("ExpiryExtended(bytes32,address,uint64)")

type RpcLog = { address: string; topics: ViemHex[]; data: ViemHex; transactionHash: ViemHex; blockNumber: string }
type RpcReceipt = { status: string; from: string; transactionHash: ViemHex; blockNumber: string; logs: RpcLog[] }

export type VerificationState =
  | {
      state: "verified"
      txHash: Hex
      renewer: Hex
      block: bigint
      /** Every entity this transaction extended, with the expiry the engine recorded. */
      extended: { key: Hex; expiresAt: bigint }[]
    }
  | { state: "unverified"; reason: string; txHash: Hex | null }
  | { state: "unknown"; reason: string }

const lower = (s: string) => s.toLowerCase()

/**
 * Pure check over a fetched transaction receipt. Exported for tests and for independent tools that
 * already hold the receipt.
 */
export function checkRenewalReceipt(claim: Receipt, tx: RpcReceipt): VerificationState {
  const txHash = tx.transactionHash as Hex
  if (tx.status !== "0x1" && tx.status !== "success") {
    return { state: "unverified", reason: "the creating transaction did not succeed", txHash }
  }
  if (!claim.creator || lower(tx.from) !== lower(claim.creator)) {
    return { state: "unverified", reason: "transaction sender is not the receipt's on-chain creator", txHash }
  }
  let createdHere = false
  const extended: { key: Hex; expiresAt: bigint }[] = []
  for (const log of tx.logs) {
    if (lower(log.address) !== lower(ARKIV_ADDRESS)) continue
    let decoded: ReturnType<typeof decodeEventLog<typeof EVENTS>>
    try {
      decoded = decodeEventLog({ abi: EVENTS, topics: log.topics as [ViemHex, ...ViemHex[]], data: log.data })
    } catch {
      continue
    }
    if (decoded.eventName === "EntityCreated" && lower(decoded.args.entityKey) === claim.key) createdHere = true
    if (decoded.eventName === "ExpiryExtended") {
      extended.push({ key: lower(decoded.args.entityKey) as Hex, expiresAt: decoded.args.expiresAt })
    }
  }
  if (!createdHere) {
    return { state: "unverified", reason: "receipt was not created by this transaction", txHash }
  }
  const target = extended.find((x) => x.key === claim.reply)
  if (!target) {
    return { state: "unverified", reason: "the same transaction did not extend the named reply", txHash }
  }
  if (target.expiresAt !== claim.targetExpiry) {
    return {
      state: "unverified",
      reason: `receipt claims expiry ${claim.targetExpiry} but the transaction set ${target.expiresAt}`,
      txHash,
    }
  }
  return { state: "verified", txHash, renewer: lower(tx.from) as Hex, block: BigInt(tx.blockNumber), extended }
}

/** Locate the receipt's creating transaction from chain logs, then run checkRenewalReceipt. */
export async function verifyRenewalReceipt(client: ArchiveClient, claim: Receipt): Promise<VerificationState> {
  if (claim.createdAtBlock === null || claim.creator === null) {
    return { state: "unknown", reason: "receipt was read without creator or creation block" }
  }
  const blockHex = `0x${claim.createdAtBlock.toString(16)}`
  let logs: RpcLog[]
  try {
    logs = (await client.request({
      method: "eth_getLogs",
      params: [
        {
          address: ARKIV_ADDRESS,
          fromBlock: blockHex,
          toBlock: blockHex,
          topics: [ENTITY_CREATED_TOPIC, claim.key],
        },
      ],
    })) as RpcLog[]
  } catch (err) {
    return { state: "unknown", reason: `log lookup failed: ${(err as Error).message}` }
  }
  if (logs.length === 0) {
    return { state: "unknown", reason: "no creation log found; the node may no longer serve that block" }
  }
  if (logs.length > 1) return { state: "unverified", reason: "ambiguous creation logs", txHash: null }
  let tx: RpcReceipt | null
  try {
    tx = (await client.request({ method: "eth_getTransactionReceipt", params: [logs[0].transactionHash] })) as RpcReceipt | null
  } catch (err) {
    return { state: "unknown", reason: `receipt lookup failed: ${(err as Error).message}` }
  }
  if (!tx) return { state: "unknown", reason: "transaction receipt not available" }
  return checkRenewalReceipt(claim, tx)
}

/**
 * The transaction that created an entity, found from its EntityCreated log at its creation block.
 * Returns null when the node no longer serves that block's logs.
 */
export async function findCreationTx(client: ArchiveClient, key: Hex, createdAtBlock: bigint): Promise<Hex | null> {
  const blockHex = `0x${createdAtBlock.toString(16)}`
  const logs = (await client.request({
    method: "eth_getLogs",
    params: [{ address: ARKIV_ADDRESS, fromBlock: blockHex, toBlock: blockHex, topics: [ENTITY_CREATED_TOPIC, key] }],
  })) as RpcLog[]
  return logs.length === 1 ? (logs[0].transactionHash as Hex) : null
}

/** Distinct verified renewing wallets. Wallets are not people; callers must label them that way. */
export function countVerifiedWallets(results: VerificationState[]): number {
  return new Set(results.flatMap((r) => (r.state === "verified" ? [r.renewer] : []))).size
}
