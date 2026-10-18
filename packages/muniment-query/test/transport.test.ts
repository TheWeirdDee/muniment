import { afterEach, expect, it, vi } from "vitest"
import { politeHttp, clearReadCache } from "../src/transport.js"
afterEach(() => vi.unstubAllGlobals())
const transport = (opts = {}) => politeHttp("https://endpoint.invalid", { concurrency: 1, attempts: 1, requestTimeoutMs: 30, totalTimeoutMs: 100, ...opts })({})
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
