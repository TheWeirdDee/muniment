import type { AttrValue, Hex, RawEntity } from "./schema.js"

type SdkLikeEntity = {
  key?: Hex
  owner?: Hex
  creator?: Hex
  createdAt?: bigint
  updatedAt?: bigint
  expiresAt?: bigint
  creationFlags?: { readonly: boolean; permissionlessExtension: boolean }
  contentType?: string
  payload?: Uint8Array
  attributes?: Record<string, { type: string; value: unknown }>
}

function toAttr(type: string, value: unknown): AttrValue | null {
  switch (type) {
    case "str":
      return typeof value === "string" ? { type, value } : null
    case "i32":
      return typeof value === "number" ? { type, value } : null
    case "u64":
    case "u256":
      if (typeof value === "bigint") return { type, value }
      if (typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value)) return { type, value: BigInt(value) }
      if (typeof value === "number" && Number.isSafeInteger(value)) return { type, value: BigInt(value) }
      return null
    case "bool":
      return typeof value === "boolean" ? { type, value } : null
    case "addr":
    case "key":
    case "bytes32":
      return typeof value === "string" ? { type, value: value.toLowerCase() } : null
    case "dec":
      return typeof value === "string" ? { type, value } : null
    default:
      return null
  }
}

/** Normalise an entity returned by `@arkiv-network/sdk` (getEntity or a select() page). */
export function fromSdkEntity(e: SdkLikeEntity): RawEntity {
  if (!e.key) throw new Error("entity key was not selected")
  const attributes: Record<string, AttrValue> = {}
  for (const [name, a] of Object.entries(e.attributes ?? {})) {
    const v = toAttr(a.type, a.value)
    if (v) attributes[name] = v
  }
  return {
    key: e.key.toLowerCase() as Hex,
    owner: e.owner,
    creator: e.creator,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    expiresAt: e.expiresAt,
    creationFlags: e.creationFlags
      ? { readonly: e.creationFlags.readonly, permissionlessExtension: e.creationFlags.permissionlessExtension }
      : undefined,
    contentType: e.contentType,
    payload: e.payload,
    attributes,
  }
}

type RpcEntity = {
  key: string
  owner?: string
  creator?: string
  createdAt?: string
  updatedAt?: string
  expiresAt?: string
  creationFlags?: { readonly: boolean; permissionlessExtension: boolean }
  contentType?: string
  payload?: string
  attributes?: { name: string; type: string; value: unknown }[]
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) throw new Error("payload is not hex")
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

function quantity(v: string | undefined): bigint | undefined {
  return v === undefined ? undefined : BigInt(v)
}

/** Normalise an entity from a raw `arkiv_query` / `arkiv_getEntity` JSON-RPC response. */
export function fromRpcEntity(e: RpcEntity): RawEntity {
  const attributes: Record<string, AttrValue> = {}
  for (const a of e.attributes ?? []) {
    const v = toAttr(a.type, a.value)
    if (v) attributes[a.name] = v
  }
  return {
    key: e.key.toLowerCase() as Hex,
    owner: e.owner as Hex | undefined,
    creator: e.creator as Hex | undefined,
    createdAt: quantity(e.createdAt),
    updatedAt: quantity(e.updatedAt),
    expiresAt: quantity(e.expiresAt),
    creationFlags: e.creationFlags,
    contentType: e.contentType,
    payload: e.payload === undefined ? undefined : hexToBytes(e.payload),
    attributes,
  }
}
