import { describe, expect, it } from "vitest"
import { decodeReply, decodeReview, isUnsupportedVersion, safeUrl } from "../src/schema.js"
import { deriveStatus, elapsedDays } from "../src/status.js"
import { PUBLISHER, REVIEWER, k, replyEntity, replyPayload, reviewEntity } from "./fixtures.js"

const bad = (r: ReturnType<typeof decodeReply>) => (r.ok ? null : r.issue.reason)

describe("decodeReply", () => {
  it("rejects contradictory durations but allows missing measurements and zero elapsed days", () => {
    expect(bad(decodeReply(replyEntity(1, { attrs: { response_days: { type: "i32", value: 1 } } })))).toMatch(/disagrees/)
    expect(decodeReply(replyEntity(1, { attrs: { response_days: undefined } })).ok).toBe(true)
    expect(decodeReply(replyEntity(1, { attrs: { replied_ms: undefined } })).ok).toBe(true)
    expect(decodeReply(replyEntity(1, { attrs: { replied_ms: { type: "u64", value: BigInt(Date.UTC(2026, 1, 1)) + 86_399_999n }, response_days: { type: "i32", value: 0 } } })).ok).toBe(true)
  })
  it("accepts a well-formed synthetic reply", () => {
    const r = decodeReply(replyEntity(1))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.responseDays).toBe(29)
      expect(r.value.creator).toBe(PUBLISHER)
      expect(r.value.payload.claimedSource.status).toBe("synthetic-no-source")
    }
  })

  it("rejects records not marked synthetic in attributes or payload", () => {
    expect(bad(decodeReply(replyEntity(1, { attrs: { synthetic: undefined } })))).toMatch(/synthetic/)
    expect(bad(decodeReply(replyEntity(1, { payload: replyPayload({ synthetic: false }) })))).toMatch(/synthetic/)
  })

  it("refuses a no-reply record that carries a reply date or answer", () => {
    const e = replyEntity(1, { attrs: { outcome: { type: "str", value: "no-reply" } } })
    expect(bad(decodeReply(e))).toMatch(/no-reply/)
    const clean = replyEntity(1, {
      attrs: { outcome: { type: "str", value: "no-reply" }, replied_ms: undefined, response_days: undefined },
      payload: replyPayload({ answer: null }),
    })
    expect(decodeReply(clean).ok).toBe(true)
  })

  it("rejects a reply dated before it was filed", () => {
    const e = replyEntity(1, { attrs: { replied_ms: { type: "u64", value: BigInt(Date.UTC(2025, 0, 1)) } } })
    expect(bad(decodeReply(e))).toMatch(/precedes/)
  })

  it("rejects a numeric attribute stored with the wrong type", () => {
    const e = replyEntity(1, { attrs: { response_days: { type: "str", value: "29" } } })
    expect(bad(decodeReply(e))).toMatch(/type str/)
  })

  it("rejects unsafe source URLs instead of rendering them", () => {
    const p = replyPayload({ claimedSource: { reference: "x", url: "javascript:alert(1)", documentDate: null, status: "url-claimed" } })
    expect(bad(decodeReply(replyEntity(1, { payload: p })))).toMatch(/safe https/)
  })

  it("requires correction attribute and payload to agree", () => {
    const p = replyPayload({ correction: { of: k(9), reason: "Typo in amount" } })
    expect(bad(decodeReply(replyEntity(2, { payload: p })))).toMatch(/disagree/)
    const ok = replyEntity(2, { payload: p, attrs: { corrects: { type: "key", value: k(9) } } })
    expect(decodeReply(ok).ok).toBe(true)
    const mismatch = replyEntity(2, { payload: p, attrs: { corrects: { type: "key", value: k(8) } } })
    expect(bad(decodeReply(mismatch))).toMatch(/different records/)
  })

  it("rejects malformed exemption sections and oversize payloads", () => {
    const p = replyPayload({ exemptions: ["8(1)(j)", "drop table"] })
    expect(bad(decodeReply(replyEntity(1, { payload: p })))).toMatch(/exemption/)
    const big = replyEntity(1)
    big.payload = new Uint8Array(70 * 1024)
    expect(bad(decodeReply(big))).toMatch(/size limit/)
  })

  it("flags unsupported schema versions distinctly", () => {
    const e = replyEntity(1, { attrs: { schema: { type: "i32", value: 2 } } })
    expect(isUnsupportedVersion(e)).toBe(true)
    expect(bad(decodeReply(e))).toMatch(/unsupported schema version/)
  })

  it("rejects entities from another namespace", () => {
    const e = replyEntity(1, { attrs: { app: { type: "str", value: "someone-else" } } })
    expect(bad(decodeReply(e))).toMatch(/not a Muniment/)
  })
})

describe("safeUrl", () => {
  it("allows only credential-free https", () => {
    expect(safeUrl("https://example.org/a")).toBe("https://example.org/a")
    expect(safeUrl("http://example.org")).toBeNull()
    expect(safeUrl("https://user:pw@example.org")).toBeNull()
    expect(safeUrl("data:text/html,x")).toBeNull()
  })
})

describe("deriveStatus", () => {
  const reply = (() => {
    const r = decodeReply(replyEntity(1))
    if (!r.ok) throw new Error("fixture")
    return r.value
  })()
  const review = (n: number, status: string, creator: typeof REVIEWER) => {
    const r = decodeReview(reviewEntity(n, reply.key, status, creator))
    if (!r.ok) throw new Error(r.issue.reason)
    return r.value
  }

  it("ignores reviews from wallets the reader does not trust", () => {
    const v = deriveStatus(reply, { reviews: [review(10, "source-compared", PUBLISHER)], corrections: [] }, [REVIEWER])
    expect(v.status).toBe("unreviewed")
    expect(v.otherReviews).toHaveLength(1)
  })

  it("lets a trusted dispute outrank a trusted comparison", () => {
    const v = deriveStatus(
      reply,
      { reviews: [review(10, "source-compared", REVIEWER), review(11, "disputed", REVIEWER)], corrections: [] },
      [REVIEWER],
    )
    expect(v.status).toBe("disputed")
  })

  it("treats only the original creator's correction as supersession", () => {
    const mk = (n: number, creator: typeof PUBLISHER) => {
      const r = decodeReply(
        replyEntity(n, {
          creator,
          payload: replyPayload({ correction: { of: reply.key, reason: "Amount corrected" } }),
          attrs: { corrects: { type: "key", value: reply.key } },
        }),
      )
      if (!r.ok) throw new Error(r.issue.reason)
      return r.value
    }
    const foreign = deriveStatus(reply, { reviews: [], corrections: [mk(20, REVIEWER)] }, [])
    expect(foreign.status).toBe("unreviewed")
    expect(foreign.proposedCorrections).toHaveLength(1)
    const own = deriveStatus(reply, { reviews: [], corrections: [mk(21, PUBLISHER)] }, [])
    expect(own.status).toBe("superseded")
  })
})

describe("elapsedDays", () => {
  it("never goes negative", () => {
    expect(elapsedDays(Date.UTC(2026, 0, 10), Date.UTC(2026, 0, 1))).toBe(0)
    expect(elapsedDays(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 31))).toBe(30)
  })
})
