import { describe, expect, it } from "vitest"
import { type RenewalCandidate, formatGlm, planRenewal } from "../src/renewal.js"
import { PUBLISHER, RENEWER, k } from "./fixtures.js"

const head = 1_000n
const target = 100_000n

const c = (n: number, over: Partial<RenewalCandidate> = {}): RenewalCandidate => ({
  key: k(n),
  kind: "reply",
  reply: k(n),
  expiresAtBlock: 50_000n,
  permissionlessExtension: true,
  owner: PUBLISHER,
  ...over,
})

describe("planRenewal", () => {
  it("never targets a record that already lives longer (Lifetime Extension never shortens)", () => {
    const p = planRenewal([c(1, { expiresAtBlock: 200_000n })], { renewer: RENEWER, targetBlock: target, headBlock: head })
    expect(p.units).toHaveLength(0)
    expect(p.skipped[0].action).toBe("already-covered")
  })

  it("refuses extensions a stranger is not permitted to make", () => {
    const p = planRenewal([c(1, { permissionlessExtension: false })], { renewer: RENEWER, targetBlock: target, headBlock: head })
    expect(p.skipped[0].action).toBe("not-permitted")
    const owner = planRenewal([c(1, { permissionlessExtension: false })], { renewer: PUBLISHER, targetBlock: target, headBlock: head })
    expect(owner.units).toHaveLength(1)
  })

  it("does not plan expired records and never writes a receipt without its reply", () => {
    const p = planRenewal(
      [c(1, { expiresAtBlock: 900n }), c(2, { kind: "appeal", reply: k(1) })],
      { renewer: RENEWER, targetBlock: target, headBlock: head },
    )
    expect(p.units).toHaveLength(0)
    expect(p.skipped.map((s) => s.action).sort()).toEqual(["expired", "extend"].sort())
  })

  it("keeps a reply and its eligible appeals in one atomic unit, deduplicated", () => {
    const p = planRenewal(
      [c(1), c(2, { kind: "appeal", reply: k(1) }), c(2, { kind: "appeal", reply: k(1) }), c(3, { kind: "appeal", reply: k(1), permissionlessExtension: false })],
      { renewer: RENEWER, targetBlock: target, headBlock: head },
    )
    expect(p.units).toHaveLength(1)
    expect(p.units[0].items.map((i) => i.key)).toEqual([k(1), k(2)])
    expect(p.units[0].operations).toBe(3)
    expect(p.skipped.map((s) => s.action)).toEqual(["not-permitted"])
  })

  it("splits units across batches without breaking a unit", () => {
    const cands = Array.from({ length: 5 }, (_, i) => c(i + 1))
    const p = planRenewal(cands, { renewer: RENEWER, targetBlock: target, headBlock: head, maxOpsPerBatch: 4 })
    expect(p.batches.map((b) => b.length)).toEqual([2, 2, 1])
    for (const b of p.batches) expect(b.reduce((n, u) => n + u.operations, 0)).toBeLessThanOrEqual(4)
  })

  it("rejects a target too close to the head", () => {
    expect(() => planRenewal([c(1)], { renewer: RENEWER, targetBlock: head + 10n, headBlock: head })).toThrow(/too close/)
  })

  it("treats unknown state as non-actionable", () => {
    const p = planRenewal([c(1, { expiresAtBlock: null })], { renewer: RENEWER, targetBlock: target, headBlock: head })
    expect(p.skipped[0].action).toBe("unknown")
  })
})

describe("formatGlm", () => {
  it("formats wei without floating point", () => {
    expect(formatGlm(1_500_000_000_000_000_000n)).toBe("1.5")
    expect(formatGlm(123n)).toBe("0")
    expect(formatGlm(123n, 18)).toBe("0.000000000000000123")
  })
})
