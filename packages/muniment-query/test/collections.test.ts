import { describe, expect, it } from "vitest"
import { type Collection, exportCollections, importCollections } from "../src/collections.js"
import { k } from "./fixtures.js"

let n = 0
const newId = () => `id-${++n}`

const sample: Collection[] = [
  {
    id: "a",
    name: "Road spending",
    createdAtMs: 1,
    items: [
      { key: k(1), addedAtMs: 2, observation: null, note: "private: call the PIO" },
      { key: k(2), addedAtMs: 3, observation: { observedAtBlock: "100", observedAtMs: 4, expiresAtBlock: "900", creator: null, title: "T", authority: "A" } },
    ],
  },
]

describe("collections export/import", () => {
  it("excludes private notes unless explicitly included", () => {
    const text = JSON.stringify(exportCollections(sample, { includeNotes: false }))
    expect(text).not.toContain("private")
    expect(JSON.stringify(exportCollections(sample, { includeNotes: true }))).toContain("private")
  })

  it("round-trips identifiers and observations", () => {
    const r = importCollections(JSON.stringify(exportCollections(sample, { includeNotes: false })), { newId })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.collections[0].items.map((i) => i.key)).toEqual([k(1), k(2)])
      expect(r.collections[0].items[1].observation?.expiresAtBlock).toBe("900")
    }
  })

  it("rejects malformed, foreign-format, wrong-chain and oversize files", () => {
    expect(importCollections("{", { newId }).ok).toBe(false)
    expect(importCollections(JSON.stringify({ format: "other" }), { newId }).ok).toBe(false)
    expect(importCollections(JSON.stringify({ format: "muniment.collection/1", network: { chainId: 1 }, collections: [] }), { newId }).ok).toBe(false)
    expect(importCollections("x".repeat(1_000_001), { newId }).ok).toBe(false)
  })

  it("drops invalid keys, merges duplicates and reports both", () => {
    const text = JSON.stringify({
      format: "muniment.collection/1",
      collections: [{ name: "x\u0000y", items: [{ key: k(1) }, { key: k(1).toUpperCase().replace("0X", "0x") }, { key: "nope" }, "junk"] }],
    })
    const r = importCollections(text, { newId })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.collections[0].items).toHaveLength(1)
      expect(r.collections[0].name).toBe("x y")
      expect(r.warnings.join(" ")).toMatch(/2 item\(s\) without a valid entity key/)
      expect(r.warnings.join(" ")).toMatch(/1 duplicate/)
    }
  })
})
