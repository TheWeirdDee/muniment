import { beforeEach, describe, expect, it, vi } from "vitest"
import { ARKIV_ADDRESS, ENTITY_CREATED_TOPIC } from "muniment-query"
import { k } from "../../packages/muniment-query/test/fixtures"
import { TransactionReceiptNotFoundError } from "viem"
const client = vi.hoisted(() => ({ getTransactionReceipt: vi.fn() }))
vi.mock("../../apps/web/src/lib/arkiv", () => ({ publicClient: () => client }))
import { submittedResult } from "../../apps/web/src/lib/transaction"
import { readTransaction, saveTransaction } from "../../apps/web/src/lib/transaction-storage"

beforeEach(() => vi.resetAllMocks())
describe("submitted transaction recovery", () => {
  it("keeps a missing receipt unknown without any send method", async () => {
    client.getTransactionReceipt.mockResolvedValue(null)
    expect(await submittedResult(k(1))).toBeNull()
    expect(client.getTransactionReceipt).toHaveBeenCalledWith({ hash: k(1) })
  })
  it("keeps the SDK's receipt-not-found exception unknown", async () => {
    client.getTransactionReceipt.mockRejectedValue(new TransactionReceiptNotFoundError({ hash: k(1) }))
    expect(await submittedResult(k(1))).toBeNull()
  })
  it("surfaces polling errors for later read-only retry", async () => {
    client.getTransactionReceipt.mockRejectedValueOnce(new Error("RPC throttled"))
    await expect(submittedResult(k(1))).rejects.toThrow("throttled")
    client.getTransactionReceipt.mockResolvedValue({ transactionHash: k(1), to: ARKIV_ADDRESS, status: "success", logs: [
      { address: ARKIV_ADDRESS, topics: [ENTITY_CREATED_TOPIC, k(2)] },
      { address: k(9), topics: [ENTITY_CREATED_TOPIC, k(3)] },
    ] })
    expect(await submittedResult(k(1))).toEqual({ state: "confirmed", created: [k(2)] })
  })
  it("distinguishes confirmed reverts and rejects unrelated receipts", async () => {
    client.getTransactionReceipt.mockResolvedValue({ transactionHash: k(1), to: ARKIV_ADDRESS, status: "reverted" })
    expect(await submittedResult(k(1))).toEqual({ state: "reverted" })
    await expect(submittedResult(k(2))).rejects.toThrow("Unexpected")
  })
  it("preserves bigint plans and hashes across tab recovery", () => {
    const data = new Map<string, string>()
    vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) })
    const plan = { tx: k(1), targetBlock: 1000n, keys: [k(2), k(3)] }
    saveTransaction("recovery", plan)
    expect(readTransaction("recovery")).toEqual(plan)
    saveTransaction("recovery", null)
    expect(readTransaction("recovery")).toBeNull()
    vi.unstubAllGlobals()
  })
})
