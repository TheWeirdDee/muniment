/**
 * Unit tests over hand-built transaction receipts (test doubles for chain responses). The live
 * proof campaign repeats the forged-claim case against Tiramisu; see evidence/proof-results.json.
 */
import { encodeAbiParameters, pad } from "viem"
import { describe, expect, it } from "vitest"
import { ARKIV_ADDRESS } from "../src/network.js"
import { decodeReceipt } from "../src/schema.js"
import { ENTITY_CREATED_TOPIC, EXPIRY_EXTENDED_TOPIC, checkRenewalReceipt, countVerifiedWallets } from "../src/verify.js"
import { PUBLISHER, RENEWER, k, receiptEntity } from "./fixtures.js"

const REPLY = k(1)
const TARGET = 90_000n

const created = (key: string, owner: string) => ({
  address: ARKIV_ADDRESS as string,
  topics: [ENTITY_CREATED_TOPIC, key, pad(owner as `0x${string}`)] as `0x${string}`[],
  data: encodeAbiParameters([{ type: "uint64" }, { type: "uint8" }], [TARGET, 1]),
  transactionHash: `0x${"11".repeat(32)}` as const,
  blockNumber: "0x1f4",
})
const extended = (key: string, owner: string, expiresAt: bigint) => ({
  address: ARKIV_ADDRESS as string,
  topics: [EXPIRY_EXTENDED_TOPIC, key, pad(owner as `0x${string}`)] as `0x${string}`[],
  data: encodeAbiParameters([{ type: "uint64" }], [expiresAt]),
  transactionHash: `0x${"11".repeat(32)}` as const,
  blockNumber: "0x1f4",
})

const claim = (creator = RENEWER, target = TARGET) => {
  const r = decodeReceipt(receiptEntity(5, REPLY, target, creator))
  if (!r.ok) throw new Error(r.issue.reason)
  return r.value
}

const tx = (from: string, logs: ReturnType<typeof created>[], status = "0x1") => ({
  status,
  from,
  transactionHash: `0x${"11".repeat(32)}` as `0x${string}`,
  blockNumber: "0x1f4",
  logs,
})

describe("checkRenewalReceipt", () => {
  it("verifies a receipt created in the same successful transaction that extended the reply", () => {
    const v = checkRenewalReceipt(claim(), tx(RENEWER, [created(k(5), RENEWER), extended(REPLY, PUBLISHER, TARGET)]))
    expect(v.state).toBe("verified")
    if (v.state === "verified") expect(v.renewer).toBe(RENEWER)
  })

  it("rejects a standalone forged receipt with no extension in its transaction", () => {
    const v = checkRenewalReceipt(claim(), tx(RENEWER, [created(k(5), RENEWER)]))
    expect(v.state).toBe("unverified")
  })

  it("rejects a receipt whose transaction extended a different reply", () => {
    const v = checkRenewalReceipt(claim(), tx(RENEWER, [created(k(5), RENEWER), extended(k(2), PUBLISHER, TARGET)]))
    expect(v.state).toBe("unverified")
  })

  it("rejects a borrowed transaction that did not create the receipt", () => {
    const v = checkRenewalReceipt(claim(), tx(RENEWER, [created(k(6), RENEWER), extended(REPLY, PUBLISHER, TARGET)]))
    expect(v.state).toBe("unverified")
  })

  it("rejects a receipt that overstates the expiry the transaction set", () => {
    const v = checkRenewalReceipt(claim(RENEWER, TARGET + 1n), tx(RENEWER, [created(k(5), RENEWER), extended(REPLY, PUBLISHER, TARGET)]))
    expect(v.state).toBe("unverified")
  })

  it("rejects a reverted transaction and a sender mismatch", () => {
    expect(checkRenewalReceipt(claim(), tx(RENEWER, [created(k(5), RENEWER), extended(REPLY, PUBLISHER, TARGET)], "0x0")).state).toBe("unverified")
    expect(checkRenewalReceipt(claim(), tx(PUBLISHER, [created(k(5), RENEWER), extended(REPLY, PUBLISHER, TARGET)])).state).toBe("unverified")
  })

  it("ignores look-alike logs from other addresses", () => {
    const foreign = { ...extended(REPLY, PUBLISHER, TARGET), address: "0x0000000000000000000000000000000000000001" }
    expect(checkRenewalReceipt(claim(), tx(RENEWER, [created(k(5), RENEWER), foreign])).state).toBe("unverified")
  })
})

describe("countVerifiedWallets", () => {
  it("counts distinct verified wallets only", () => {
    const ok = { state: "verified" as const, txHash: k(1), renewer: RENEWER, block: 1n, extended: [] }
    expect(countVerifiedWallets([ok, ok, { state: "unverified", reason: "x", txHash: null }])).toBe(1)
  })
})
