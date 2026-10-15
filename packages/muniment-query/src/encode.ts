/**
 * A minimal encoder for Arkiv `execute` calldata, written from the documented wire format
 * (docs.arkiv.network/json-rpc/mutating-entities). Muniment uses it only to *estimate* gas for a
 * renewal quote before the wallet signs; the write itself goes through the official SDK. A unit test
 * checks that this encoder and the SDK produce identical calldata.
 */
import { encodeAbiParameters, encodeFunctionData, parseAbiParameters, stringToBytes, toHex, type Hex } from "viem"

export type WireAttr =
  | { name: string; type: "str"; value: string }
  | { name: string; type: "i32"; value: number }
  | { name: string; type: "u64"; value: bigint }
  | { name: string; type: "bool"; value: boolean }
  | { name: string; type: "key"; value: Hex }
  | { name: string; type: "bytes"; value: Uint8Array }

const TYPE_ID = { bool: 1, i32: 2, u64: 3, u256: 4, dec: 5, bytes32: 6, bytes: 7, str: 8, addr: 9, key: 10 } as const

const ATTR = "(bytes32 name, uint8 typeId, bytes value)[]"
const CREATE = parseAbiParameters(
  `(uint128 salt, uint64 expiresAt, uint64 minLifetime, uint8 creationFlags, ${ATTR} attributes)`,
)
const EXTEND = parseAbiParameters("(bytes32 entityKey, uint64 expiresAt, uint64 minLifetime)")
const EXECUTE_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "operation", type: "uint8" },
          { name: "operationData", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "keys", type: "bytes32[]" }],
  },
] as const

function word(v: bigint): Hex {
  const masked = v < 0n ? (1n << 256n) + v : v
  return toHex(masked, { size: 32 })
}

function encodeValue(a: WireAttr): Hex {
  switch (a.type) {
    case "str":
      return toHex(stringToBytes(a.value))
    case "i32":
      return word(BigInt(a.value))
    case "u64":
      return word(a.value)
    case "bool":
      return word(a.value ? 1n : 0n)
    case "key":
      return toHex(BigInt(a.value), { size: 32 })
    case "bytes":
      return toHex(a.value)
  }
}

export function encodeAttributeList(attrs: WireAttr[]) {
  return attrs
    .map((a) => ({ name: toHex(a.name, { size: 32 }), typeId: TYPE_ID[a.type], value: encodeValue(a) }))
    .sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0))
}

export type WireCreate = {
  salt: bigint
  expiresAt: bigint
  minLifetime: bigint
  flags: { readonly: boolean; permissionlessExtension: boolean }
  payload: Uint8Array
  contentType: string
  attributes: WireAttr[]
}

export type WireExtend = { entityKey: Hex; expiresAt: bigint; minLifetime: bigint }

export function encodeCreate(c: WireCreate): Hex {
  const flags = (c.flags.readonly ? 1 : 0) | (c.flags.permissionlessExtension ? 2 : 0)
  const attributes = encodeAttributeList([
    ...c.attributes,
    { name: "$payload", type: "bytes", value: c.payload },
    { name: "$contentType", type: "str", value: c.contentType },
  ])
  return encodeAbiParameters(CREATE, [
    { salt: c.salt, expiresAt: c.expiresAt, minLifetime: c.minLifetime, creationFlags: flags, attributes },
  ])
}

export function encodeExtend(e: WireExtend): Hex {
  return encodeAbiParameters(EXTEND, [{ entityKey: e.entityKey, expiresAt: e.expiresAt, minLifetime: e.minLifetime }])
}

/** Calldata for one atomic batch, in the SDK's order: creates, then extensions. */
export function encodeExecute(ops: { creates?: WireCreate[]; extensions?: WireExtend[] }): Hex {
  const list = [
    ...(ops.creates ?? []).map((c) => ({ operation: 1, operationData: encodeCreate(c) })),
    ...(ops.extensions ?? []).map((e) => ({ operation: 3, operationData: encodeExtend(e) })),
  ]
  if (list.length === 0) throw new Error("empty batch")
  return encodeFunctionData({ abi: EXECUTE_ABI, functionName: "execute", args: [list] })
}
