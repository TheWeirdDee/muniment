import type { AttrValue, Hex, RawEntity } from "../src/schema.js"

export const PUBLISHER = "0x817574740f413816636fae23064607084e2c0604" as Hex
export const RENEWER = "0xe0e47735c1add1390e03766d7bd06ec913485de7" as Hex
export const REVIEWER = "0xec5c622d43217c5da7c006be11909c0fb6fff5c1" as Hex

export const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex

const s = (value: string): AttrValue => ({ type: "str", value })
const i = (value: number): AttrValue => ({ type: "i32", value })
const u = (value: bigint | number): AttrValue => ({ type: "u64", value: BigInt(value) })
const key = (value: string): AttrValue => ({ type: "key", value })

export function replyPayload(over: Record<string, unknown> = {}) {
  return {
    schema: "muniment.reply/1",
    synthetic: true,
    title: "Road resurfacing expenditure, Ward 4 (synthetic)",
    question: "Provide the sanctioned and spent amounts for resurfacing in Ward 4 for 2025-26.",
    answer: "Sanctioned: 4.2 crore. Spent to date: 3.1 crore. Work orders attached as annexure A (synthetic).",
    authorityName: "Ravipur Municipal Corporation (synthetic)",
    jurisdictionName: "Sundarvan (fictional state)",
    claimedSource: { reference: "RMC/RTI/2026/0141", url: null, documentDate: "2026-03-02", status: "synthetic-no-source" },
    attachment: null,
    exemptions: [],
    correction: null,
    disclosure: "Synthetic test record created for the Muniment hackathon demo. Not a real government reply.",
    ...over,
  }
}

export function replyEntity(n: number, over: { attrs?: Record<string, AttrValue | undefined>; payload?: unknown; creator?: Hex } = {}): RawEntity {
  const attributes: Record<string, AttrValue> = {
    app: s("muniment-archive"),
    schema: i(1),
    kind: s("reply"),
    synthetic: { type: "bool", value: true },
    authority: s("ravipur-mc"),
    jurisdiction: s("sundarvan"),
    topic: s("roads"),
    outcome: s("granted"),
    language: s("en"),
    filed_ms: u(Date.UTC(2026, 1, 1)),
    replied_ms: u(Date.UTC(2026, 2, 2)),
    response_days: i(29),
    ref: s("RMC/RTI/2026/0141"),
  }
  for (const [name, v] of Object.entries(over.attrs ?? {})) {
    if (v === undefined) delete attributes[name]
    else attributes[name] = v
  }
  return {
    key: k(n),
    creator: over.creator ?? PUBLISHER,
    owner: over.creator ?? PUBLISHER,
    createdAt: 100n,
    expiresAt: 10_000n,
    creationFlags: { readonly: true, permissionlessExtension: true },
    contentType: "application/json",
    payload: new TextEncoder().encode(JSON.stringify(over.payload ?? replyPayload())),
    attributes,
  }
}

export function reviewEntity(n: number, reply: Hex, status: string, creator: Hex): RawEntity {
  return {
    key: k(n),
    creator,
    owner: creator,
    createdAt: 200n,
    expiresAt: 20_000n,
    creationFlags: { readonly: true, permissionlessExtension: false },
    contentType: "application/json",
    payload: new TextEncoder().encode(
      JSON.stringify({ schema: "muniment.review/1", method: "Compared with synthetic source", limitations: "Synthetic", evidenceRef: null, observedAt: "2026-10-15" }),
    ),
    attributes: { app: s("muniment-archive"), schema: i(1), kind: s("review"), reply: key(reply), status: s(status) },
  }
}

export function receiptEntity(n: number, reply: Hex, target: bigint, creator: Hex, createdAt = 500n): RawEntity {
  return {
    key: k(n),
    creator,
    owner: creator,
    createdAt,
    expiresAt: target,
    creationFlags: { readonly: true, permissionlessExtension: false },
    contentType: "application/json",
    payload: new TextEncoder().encode(JSON.stringify({ schema: "muniment.receipt/1", note: "x", extendedCount: 1 })),
    attributes: { app: s("muniment-archive"), schema: i(1), kind: s("receipt"), reply: key(reply), target_expiry: u(target) },
  }
}
