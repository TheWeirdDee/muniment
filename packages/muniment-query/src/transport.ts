/**
 * A rate-limit-aware JSON-RPC transport for the public Arkiv endpoint.
 *
 * Observed on Tiramisu (October 2026): responses carry `RateLimit: limit=…, remaining=…, reset=…`.
 * There is a short per-minute budget and a larger windowed budget; when either is spent the node
 * answers HTTP 429. This transport caps concurrency, waits out 429/5xx responses using
 * `Retry-After` or the `reset` hint (bounded by `maxWaitMs`), and then surfaces the real failure.
 * It never fabricates a result.
 */
import { custom } from "viem"

export type PoliteTransportOptions = {
  /** Maximum requests in flight at once. */
  concurrency?: number
  /** Attempts per request, including the first. */
  attempts?: number
  /** Longest single wait for a rate-limit reset before giving up. */
  maxWaitMs?: number
  /** Called when the transport starts waiting on a rate limit (for UI or logs). */
  onThrottle?: (info: { status: number; waitMs: number; method: string }) => void
  /**
   * Reuse identical read results for this many milliseconds (0 disables). Applies only to
   * arkiv_query, arkiv_getEntity, eth_getLogs and eth_getTransactionReceipt; identical concurrent
   * requests always share one network call. Query results carry the block they were read at.
   */
  cacheMs?: number
  requestTimeoutMs?: number
  totalTimeoutMs?: number
  signal?: AbortSignal
}

const CACHEABLE = new Set(["arkiv_query", "arkiv_getEntity", "eth_getLogs", "eth_getTransactionReceipt"])

/** Drop cached reads, e.g. after a write so the next read reflects it. */
export function clearReadCache() {
  for (const ref of caches) {
    const cache = ref.deref()
    if (cache) cache.clear()
    else caches.delete(ref)
  }
}
const caches = new Set<WeakRef<Map<string, { at: number; value: Promise<unknown> }>>>()

export class RpcHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly method: string,
  ) {
    super(message)
    this.name = "RpcHttpError"
  }
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return }
  const abort = () => { clearTimeout(timer); reject(signal.reason) }
  const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve() }, ms)
  signal.addEventListener("abort", abort, { once:true })
})

/** Also bounds providers that fail to honour fetch's AbortSignal, including a stalled body. */
function cancellable<T>(value: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) { value.catch(() => {}); abort(); return }
    signal.addEventListener("abort", abort, { once: true })
    value.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
}

/** Seconds until the advertised budget resets, from a `RateLimit` header, when it is exhausted. */
export function parseRateLimitReset(header: string | null): number | null {
  if (!header) return null
  const remaining = /remaining=(\d+)/.exec(header)?.[1]
  const reset = /reset=(\d+)/.exec(header)?.[1]
  if (remaining === undefined || reset === undefined) return null
  return Number(remaining) === 0 ? Number(reset) : null
}

export function politeHttp(url: string, opts: PoliteTransportOptions = {}) {
  const concurrency = opts.concurrency ?? 2
  const attempts = opts.attempts ?? 5
  const maxWaitMs = opts.maxWaitMs ?? 15_000
  let inFlight = 0
  const queue: (() => void)[] = []
  let cooldownUntil = 0
  let id = 0
  const cacheMs = opts.cacheMs ?? 0
  const cache = new Map<string, { at: number; value: Promise<unknown> }>()
  for (const ref of caches) if (!ref.deref()) caches.delete(ref)
  caches.add(new WeakRef(cache))

  const acquire = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const abort = () => { const i = queue.indexOf(grant); if (i >= 0) queue.splice(i, 1); reject(signal.reason) }
    const grant = () => { signal.removeEventListener("abort", abort); inFlight++; resolve() }
    if (inFlight < concurrency) grant()
    else { queue.push(grant); signal.addEventListener("abort", abort, { once: true }) }
  })
  const release = () => {
    inFlight--
    queue.shift()?.()
  }

  async function send(method: string, params: unknown): Promise<unknown> {
    const total = new AbortController()
    const requestTimeout = opts.requestTimeoutMs ?? 20_000
    const timer = setTimeout(() => total.abort(new DOMException("Arkiv total request deadline exceeded", "TimeoutError")), opts.totalTimeoutMs ?? Math.max(60_000, maxWaitMs + requestTimeout))
    const signal = opts.signal ? AbortSignal.any([opts.signal, total.signal]) : total.signal
    try {
      for (let attempt = 1; ; attempt++) {
        signal.throwIfAborted()
        const wait = cooldownUntil - Date.now()
        if (wait > 0) await sleep(wait, signal)
        await acquire(signal)
        const attemptController = new AbortController()
        const attemptTimer = setTimeout(() => attemptController.abort(new DOMException("Arkiv request timed out", "TimeoutError")), requestTimeout)
        const attemptSignal = AbortSignal.any([signal, attemptController.signal])
        let res: Response
        let body: { result?: unknown; error?: { code: number; message: string; data?: unknown } } | undefined
        try {
          res = await cancellable(fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: params ?? [] }),
            signal: attemptSignal,
          }), attemptSignal)
          if (res.ok) body = await cancellable(res.json(), attemptSignal)
        } catch (err) {
          if (signal.aborted) throw signal.reason
          if (attemptSignal.aborted) throw new RpcHttpError(0, "Arkiv request timed out before its response body completed", method)
          if (attempt >= attempts) throw new RpcHttpError(0, `Network error reaching Arkiv: ${(err as Error).message}`, method)
          await sleep(400 * 2 ** attempt, signal)
          continue
        } finally {
          clearTimeout(attemptTimer)
          release()
        }
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers.get("retry-after"))
          const reset = parseRateLimitReset(res.headers.get("ratelimit"))
          const hinted = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : reset !== null ? reset * 1000 : null
          const delay = hinted ?? 500 * 2 ** attempt + Math.random() * 300
          if (attempt >= attempts || delay > maxWaitMs) {
            throw new RpcHttpError(
              res.status,
              res.status === 429
                ? `Arkiv rate limit reached (HTTP 429)${hinted ? `; the endpoint says retry in about ${Math.ceil(hinted / 1000)} s` : ""}`
                : `Arkiv answered HTTP ${res.status}`,
              method,
            )
          }
          opts.onThrottle?.({ status: res.status, waitMs: delay, method })
          cooldownUntil = Math.max(cooldownUntil, Date.now() + delay)
          continue
        }
        if (!res.ok) throw new RpcHttpError(res.status, `Arkiv answered HTTP ${res.status}`, method)
        if (body?.error) {
          const e = new Error(body.error.message) as Error & { code: number; data?: unknown }
          e.code = body.error.code
          e.data = body.error.data
          throw e
        }
        return body?.result
      }
    } finally { clearTimeout(timer) }
  }

  return custom({
    async request({ method, params }: { method: string; params?: unknown }) {
      if (!CACHEABLE.has(method)) return send(method, params)
      const key = `${method}:${JSON.stringify(params ?? [])}`
      const hit = cache.get(key)
      if (hit && (Date.now() - hit.at < cacheMs || cacheMs === 0)) {
        // With cacheMs = 0 an entry exists only while its request is in flight (de-duplication).
        return hit.value
      }
      const value = send(method, params)
      if (cache.size >= 256) cache.delete(cache.keys().next().value!)
      cache.set(key, { at: Date.now(), value })
      value.then(
        (v) => {
          // Receipts that are not yet available must not be remembered.
          if ((cacheMs === 0 || v === null) && cache.get(key)?.value === value) cache.delete(key)
        },
        () => { if (cache.get(key)?.value === value) cache.delete(key) },
      )
      return value
    },
  }, { retryCount: 0 })
}
