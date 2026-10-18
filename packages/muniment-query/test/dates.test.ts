import { describe, expect, it } from "vitest"
import { inclusiveUtcRange, utcDay } from "../src/dates.js"

describe("inclusive UTC filing dates", () => {
  it("includes the entire selected day, excluding the next day", () => {
    const r = inclusiveUtcRange("2026-10-18", "2026-10-18")
    expect(r.from).toBe(Date.UTC(2026, 9, 18))
    expect(r.through).toBe(Date.UTC(2026, 9, 19) - 1)
  })
  it("accepts leap days and open bounds", () => {
    expect(utcDay("2024-02-29")).toBe(Date.UTC(2024, 1, 29))
    expect(inclusiveUtcRange("", "")).toEqual({ from: undefined, through: undefined })
  })
  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-2-01", "invalid"])("rejects impossible or malformed date %s", date => {
    expect(utcDay(date)).toBeNull()
    expect(() => inclusiveUtcRange(date, "")).toThrow("valid UTC")
  })
  it("rejects reversed ranges", () => {
    expect(() => inclusiveUtcRange("2026-10-19", "2026-10-18")).toThrow("later")
  })
})
