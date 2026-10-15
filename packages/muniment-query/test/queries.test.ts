import { describe, expect, it } from "vitest"
import { QueryInputError, expiringQuery, keysQuery, linkedQuery, replyQuery, strLit } from "../src/queries.js"
import { k } from "./fixtures.js"

describe("query builders", () => {
  it("always pins namespace, schema version and kind", () => {
    expect(replyQuery()).toBe(
      "app = str('muniment-archive') AND schema = i32(1) AND kind = str('reply') AND synthetic = true",
    )
  })

  it("renders typed numeric ranges, not string comparisons", () => {
    const q = replyQuery({ filedFromMs: 1, filedToMs: 2, responseDaysMin: 0, responseDaysMax: 30 })
    expect(q).toContain("filed_ms >= u64(1)")
    expect(q).toContain("filed_ms <= u64(2)")
    expect(q).toContain("response_days >= i32(0)")
    expect(q).toContain("response_days <= i32(30)")
  })

  it("ORs trusted creators and ANDs them with filters", () => {
    const q = replyQuery({ creators: ["0x817574740F413816636FAE23064607084e2C0604", "0xe0e47735c1add1390E03766D7Bd06eC913485DE7"] })
    expect(q).toMatch(/AND \(\$creator = addr\(0x8175[^)]+\) OR \$creator = addr\(0xe0e4[^)]+\)\)$/)
  })

  it("escapes quotes and refuses control characters and injection-shaped input", () => {
    expect(strLit("a' OR '1'='1")).toBe("str('a'' OR ''1''=''1')")
    expect(() => strLit("a\nAND x = 1")).toThrow(QueryInputError)
    expect(() => replyQuery({ outcome: "anything" as never })).toThrow(QueryInputError)
    expect(() => replyQuery({ exemption: "8) OR (1" })).toThrow(QueryInputError)
    expect(() => linkedQuery("appeal", "0xnot-a-key" as never)).toThrow(QueryInputError)
  })

  it("bounds key lists and expiry windows", () => {
    expect(() => keysQuery([])).toThrow(QueryInputError)
    expect(() => keysQuery(Array.from({ length: 21 }, (_, i) => k(i)))).toThrow(QueryInputError)
    expect(() => expiringQuery(10n, 5n)).toThrow(QueryInputError)
    expect(expiringQuery(5n, 10n)).toContain("$expiresAt >= u64(5) AND $expiresAt <= u64(10)")
  })
})
