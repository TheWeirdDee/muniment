// Repro: `readonly` does not stop the owner deleting an entity; transferring ownership to a burn
// address in the creating batch removes that ability. Creates two short-lived control entities.
//   node --env-file=.env --import tsx arkiv/friction/04-readonly-delete-and-seal.ts
import { ExpirationTime, createPublicClient, createWalletClient, jsonToPayload } from "@arkiv-network/sdk"
import { str } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const account = privateKeyToAccount(process.env.PUBLISHER_KEY as `0x${string}`)
const pub = createPublicClient({ chain: tiramisu, transport: http() })
const w = createWalletClient({ chain: tiramisu, transport: http(), account })
const base = { payload: jsonToPayload({ control: true }), contentType: "application/json" as const, attributes: { app: str("muniment-friction"), kind: str("control") }, expires: ExpirationTime.fromHours(1), flags: { readonly: true, permissionlessExtension: true } }
const plain = await w.createEntity(base)
console.log("owner deletes a readonly entity:", (await w.deleteEntity({ entityKey: plain.entityKey })).txHash)
const [pred] = await pub.predictEntityKeys({ owner: account.address, count: 1 })
const sealed = await w.executeBatch({ creates: [{ ...base, salt: pred.salt }], ownershipChanges: [{ entityKey: pred.key, newOwner: "0x000000000000000000000000000000000000dEaD" }] })
try {
  await w.deleteEntity({ entityKey: sealed.createdEntities[0] })
  console.log("UNEXPECTED: sealed entity deleted")
} catch (e) {
  console.log("sealed entity delete rejected:", (e as Error).message.split("\n")[0])
}
