import { useEffect, useRef, useState } from "react"
import { publicClient } from "./arkiv"
import type { HeadAnchor } from "./format"

let shared: { anchor: HeadAnchor; at: number } | null = null
let inflight: Promise<HeadAnchor> | null = null

/** The current block and its timestamp, refreshed at most every 15 seconds and shared across views. */
export async function fetchHead(force = false): Promise<HeadAnchor> {
  if (!force && shared && Date.now() - shared.at < 15_000) return shared.anchor
  inflight ??= (async () => {
    try {
      const t = await publicClient().getBlockTiming()
      const anchor = { block: t.currentBlock, timeMs: t.currentBlockTime * 1000 }
      shared = { anchor, at: Date.now() }
      return anchor
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function useHead(intervalMs = 20_000) {
  const [head, setHead] = useState<HeadAnchor | null>(shared?.anchor ?? null)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    let alive = true
    const tick = () =>
      fetchHead()
        .then((h) => {
          if (alive) {
            setHead(h)
            setError(null)
          }
        })
        .catch((e) => alive && setError(e))
    tick()
    const t = window.setInterval(tick, intervalMs)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [intervalMs])
  return { head, error }
}

export type Async<T> = { status: "idle" | "loading"; data?: T } | { status: "ready"; data: T } | { status: "error"; error: unknown; data?: T }

/** Run an async loader with cancellation; stale responses never overwrite newer ones. */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]): Async<T> & { reload: () => void } {
  const [state, setState] = useState<Async<T>>({ status: "loading" })
  const [nonce, setNonce] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    const ctl = new AbortController()
    setState((s) => ({ status: "loading", data: s.data }))
    fnRef
      .current(ctl.signal)
      .then((data) => {
        if (!ctl.signal.aborted) setState({ status: "ready", data })
      })
      .catch((error) => {
        if (!ctl.signal.aborted) setState((s) => ({ status: "error", error, data: s.data }))
      })
    return () => ctl.abort()
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps supplied by caller
  }, [...deps, nonce])
  return { ...state, reload: () => setNonce((n) => n + 1) } as Async<T> & { reload: () => void }
}

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-visible")
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible")
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}
