import { type ExecuteBatchParameters, toValue } from "@arkiv-network/sdk"
import { ARKIV_ADDRESS, encodeExecute, estimateCost, type Hex, type WireAttr } from "muniment-query"
import { publicClient } from "./arkiv"

/** Quote the very same salted creates and ownership changes retained for signing. */
export async function publicationQuote(params: ExecuteBatchParameters, from: Hex) {
  const creates = (params.creates ?? []).map(c => ({
    salt: c.salt as bigint,
    expiresAt: c.expires.expiresAt as bigint,
    minLifetime: c.expires.minLifetime,
    payload: c.payload ?? new Uint8Array(),
    contentType: c.contentType ?? "application/octet-stream",
    flags: { readonly: !!c.flags?.readonly, permissionlessExtension: !!c.flags?.permissionlessExtension },
    attributes: Object.entries(c.attributes ?? {}).map(([name, input]) => {
      const value = toValue(input)
      if (!["str", "bool", "key", "i32", "u64"].includes(value.type)) throw new Error("Unsupported publication quote attribute")
      return { name, type: value.type, value: value.value } as WireAttr
    }),
  }))
  const data = encodeExecute({ creates, ownershipChanges: params.ownershipChanges })
  const client = publicClient()
  if (await client.getChainId() !== 7738577) throw new Error("The read endpoint is not Tiramisu.")
  const rpc = client as unknown as { request(args: { method: string; params: unknown[] }): Promise<string> }
  const gas = BigInt(await rpc.request({ method: "eth_estimateGas", params: [{ from, to: ARKIV_ADDRESS, data }] }))
  const price = BigInt(await rpc.request({ method: "eth_gasPrice", params: [] }))
  return estimateCost(gas, price)
}
