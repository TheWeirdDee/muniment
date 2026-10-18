/**
 * TEST DOUBLE NOTICE: this test replaces the RPC transport with an in-memory stub so it can capture
 * the calldata the official SDK would broadcast. It proves encoder equivalence only — not chain
 * acceptance, which the live proof campaign (scripts/proof.ts) covers.
 */
import { ExpirationTime, createWalletClient, jsonToPayload } from "@arkiv-network/sdk"
import { i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { custom } from "viem"
import { describe, expect, it } from "vitest"
import { encodeExecute } from "../src/encode.js"
import { receiptPayload, receiptWireAttributes } from "../src/renewal.js"

const ACCOUNT = "0x817574740F413816636FAE23064607084e2C0604"
const REPLY = `0x${"ab".repeat(32)}` as const
const APPEAL = `0x${"cd".repeat(32)}` as const

function capturingClient() {
  let captured: string | null = null
  const transport = custom({
    async request({ method, params }: { method: string; params?: unknown[] }) {
      switch (method) {
        case "eth_chainId":
          return "0x7614d1"
        case "eth_blockNumber":
          return "0x1000"
        case "eth_sendTransaction":
          captured = (params?.[0] as { data: string }).data
          throw new Error("captured")
        case "eth_estimateGas":
          return "0x100000"
        case "eth_gasPrice":
        case "eth_maxPriorityFeePerGas":
          return "0x1"
        case "eth_getBlockByNumber":
          return { baseFeePerGas: "0x1", number: "0x1000", timestamp: "0x0", transactions: [] }
        case "eth_getTransactionCount":
          return "0x0"
        default:
          throw new Error(`unexpected ${method}`)
      }
    },
  })
  const client = createWalletClient({ chain: tiramisu, transport, account: ACCOUNT })
  return { client, get data() { return captured } }
}

describe("encodeExecute matches the SDK's calldata", () => {
  it("quotes publication creates and ownership changes with exact SDK calldata", async () => {
    const cap = capturingClient()
    const flags = { readonly: true, permissionlessExtension: true }
    const payload = jsonToPayload({ synthetic: true, title: "Quote regression" })
    const newOwner = "0x000000000000000000000000000000000000dEaD"
    await cap.client.executeBatch({
      creates: [{ payload, contentType: "application/json", attributes: { app: str("muniment-archive"), synthetic: true }, salt: 10n, expires: ExpirationTime.fromDays(7), flags }],
      ownershipChanges: [{ entityKey: REPLY, newOwner }],
    }).catch(() => undefined)
    expect(cap.data).not.toBeNull()
    expect(encodeExecute({ creates: [{ payload, contentType: "application/json", salt: 10n, expiresAt: 0n, minLifetime: 302400n, flags,
      attributes: [{ name: "app", type: "str", value: "muniment-archive" }, { name: "synthetic", type: "bool", value: true }] }],
      ownershipChanges: [{ entityKey: REPLY, newOwner }],
    })).toBe(cap.data)
  })
  it("for a renewal batch: receipt create plus two absolute extensions", async () => {
    const target = 2_000_000n
    const cap = capturingClient()
    await cap.client
      .executeBatch({
        creates: [
          {
            payload: receiptPayload(2),
            contentType: "application/json",
            attributes: {
              app: str("muniment-archive"),
              schema: i32(1),
              kind: str("receipt"),
              reply: key(REPLY),
              target_expiry: u64(target),
            },
            expires: ExpirationTime.atBlock(target),
            flags: { readonly: true, permissionlessExtension: false },
            salt: 42n,
          },
        ],
        extensions: [
          { entityKey: REPLY, expires: ExpirationTime.atBlock(target) },
          { entityKey: APPEAL, expires: ExpirationTime.atBlock(target) },
        ],
      })
      .catch(() => undefined)
    expect(cap.data).not.toBeNull()

    const ours = encodeExecute({
      creates: [
        {
          salt: 42n,
          expiresAt: target,
          minLifetime: 0n,
          flags: { readonly: true, permissionlessExtension: false },
          payload: receiptPayload(2),
          contentType: "application/json",
          attributes: receiptWireAttributes(REPLY, target),
        },
      ],
      extensions: [
        { entityKey: REPLY, expiresAt: target, minLifetime: 0n },
        { entityKey: APPEAL, expiresAt: target, minLifetime: 0n },
      ],
    })
    expect(ours).toBe(cap.data)
  })

  it("encodes JSON payloads and bool attributes identically", async () => {
    const cap = capturingClient()
    await cap.client
      .createEntity({
        payload: jsonToPayload({ a: 1 }),
        contentType: "application/json",
        attributes: { app: str("x"), synthetic: true },
        expires: ExpirationTime.fromBlocks(100),
        salt: 7n,
      })
      .catch(() => undefined)
    const ours = encodeExecute({
      creates: [
        {
          salt: 7n,
          expiresAt: 0n,
          minLifetime: 100n,
          flags: { readonly: false, permissionlessExtension: false },
          payload: jsonToPayload({ a: 1 }),
          contentType: "application/json",
          attributes: [
            { name: "app", type: "str", value: "x" },
            { name: "synthetic", type: "bool", value: true },
          ],
        },
      ],
    })
    expect(ours).toBe(cap.data)
  })
})
