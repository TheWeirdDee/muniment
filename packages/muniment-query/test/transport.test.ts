import { afterEach, expect, it, vi } from "vitest"
import { politeHttp, clearReadCache } from "../src/transport.js"
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
let endpointId = 0
const transport = (opts = {}) => politeHttp(`https://endpoint-${++endpointId}.invalid`, { concurrency: 1, attempts: 1, requestTimeoutMs: 30, totalTimeoutMs: 100, ...opts })({})

it("retains a long advertised cooldown across transports without further network calls", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "991" } }))
  vi.stubGlobal("fetch", fetch)
  const make = () => politeHttp("https://shared-cooldown.invalid", { attempts: 1, maxWaitMs: 10 })({})
  await expect(make().request({ method: "arkiv_query" })).rejects.toThrow(/991 s/)
  await expect(make().request({ method: "eth_chainId" })).rejects.toThrow(/request cooldown/)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it("respects persisted browser cooldowns and resumes after their expiry", async () => {
  let now = 1_000_000
  vi.spyOn(Date, "now").mockImplementation(() => now)
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: "available" })))
  vi.stubGlobal("fetch", fetch)
  vi.stubGlobal("localStorage", { getItem: () => String(1_060_000) })
  const t = politeHttp("https://persisted-cooldown.invalid", { attempts: 1, maxWaitMs: 1 })({})
  await expect(t.request({ method: "eth_chainId" })).rejects.toThrow(/60 s/)
  expect(fetch).not.toHaveBeenCalled()
  now = 1_060_001
  await expect(t.request({ method: "eth_chainId" })).resolves.toBe("available")
  expect(fetch).toHaveBeenCalledTimes(1)
})
it("stops queued requests after the first response advertises a long cooldown", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "900" } }))
  vi.stubGlobal("fetch", fetch)
  const t = politeHttp("https://queued-cooldown.invalid", { concurrency: 1, attempts: 1, maxWaitMs: 1 })({})
  const results = await Promise.allSettled([t.request({ method: "one" }), t.request({ method: "two" }), t.request({ method: "three" })])
  expect(results.every(r => r.status === "rejected")).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it("uses a conservative client cooldown when retry headers are absent or not CORS-visible", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("", { status: 429 }))
  vi.stubGlobal("fetch", fetch)
  const t = politeHttp("https://unhinted-cooldown.invalid", { attempts: 5, maxWaitMs: 1 })({})
  await expect(t.request({ method: "eth_chainId" })).rejects.toThrow(/rate limit/)
  await expect(t.request({ method: "eth_chainId" })).rejects.toThrow(/request cooldown/)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it("honours an HTTP-date Retry-After hint", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": new Date(Date.now() + 60_000).toUTCString() } }))
  vi.stubGlobal("fetch", fetch)
  await expect(transport().request({ method: "eth_chainId" })).rejects.toThrow(/about 60 s/)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it("bounds retained reads and clears all live transport caches", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ result: "fixture" })))
  vi.stubGlobal("fetch", fetch)
  const t = transport({ cacheMs: 60000, requestTimeoutMs: 1000, totalTimeoutMs: 2000 })
  for (let n = 0; n < 257; n++) await t.request({ method: "arkiv_query", params: [n] })
  await t.request({ method: "arkiv_query", params: [0] })
  expect(fetch).toHaveBeenCalledTimes(258)
  await t.request({ method: "arkiv_query", params: [0] })
  expect(fetch).toHaveBeenCalledTimes(258)
  clearReadCache()
  await t.request({ method: "arkiv_query", params: [0] })
  expect(fetch).toHaveBeenCalledTimes(259)
})
it("handles a fetch rejecting during synchronous cancellation without an orphan rejection", async () => {
  const ctl = new AbortController()
  vi.stubGlobal("fetch", vi.fn(() => {
    ctl.abort(new Error("navigation cancelled"))
    return Promise.reject(new Error("fetch aborted"))
  }))
  await expect(transport({ signal: ctl.signal }).request({ method: "arkiv_query" })).rejects.toThrow("navigation cancelled")
})
it("bounds a hung fetch and releases the slot for a following request", async () => {
  const fetch = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(new Response(JSON.stringify({ result: "recovered" })))
  vi.stubGlobal("fetch", fetch)
  const t = transport()
  await expect(t.request({ method: "eth_chainId" })).rejects.toThrow(/timed out/)
  await expect(t.request({ method: "eth_chainId" })).resolves.toBe("recovered")
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
})
it("bounds a stalled response body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) }))
  await expect(transport().request({ method: "eth_chainId" })).rejects.toThrow(/timed out/)
})
it("cancels active and queued calls when their caller aborts", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
  const ctl = new AbortController()
  const t = transport({ signal: ctl.signal })
  const a = t.request({ method: "one" }), b = t.request({ method: "two" })
  ctl.abort(new Error("navigation cancelled"))
  await expect(a).rejects.toThrow(/navigation cancelled/)
  await expect(b).rejects.toThrow(/navigation cancelled/)
})
it("keeps rate limits distinct from deadlines", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "60" } })))
  await expect(transport().request({ method: "arkiv_query" })).rejects.toThrow(/rate limit.*429/)
})
it("bounds the total deadline including advertised retry waits", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", {status:429,headers:{"Retry-After":"2"}})))
 await expect(transport({attempts:2,maxWaitMs:3000,totalTimeoutMs:30}).request({method:"eth_chainId"})).rejects.toThrow(/total request deadline/)
})
