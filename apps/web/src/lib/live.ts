import { useEffect, useRef, useState } from "react"
import { wsClient } from "./arkiv"

export type LiveState = "connecting" | "live" | "fallback"

/**
 * Subscribe to Arkiv entity events over WebSocket (no fromBlock, so the SDK opens a real
 * subscription rather than polling) and call onChange when one of `keys` changes. If the socket
 * errors, fall back to reconciling every 30 seconds and say so. Expiry fires no event, so callers
 * also reconcile on that interval regardless.
 */
export function useEntityEvents(keys: string[], onChange: (reason: string) => void): LiveState {
  const [state, setState] = useState<LiveState>("connecting")
  const cb = useRef(onChange)
  cb.current = onChange
  const keyList = keys.map((k) => k.toLowerCase()).sort().join(",")
  useEffect(() => {
    if (!keyList) return
    const watched = new Set(keyList.split(","))
    let unwatch: (() => void) | null = null
    let fallbackTimer: number | null = null
    let alive = true
    const startFallback = () => {
      if (fallbackTimer !== null) return
      setState("fallback")
      fallbackTimer = window.setInterval(() => cb.current("periodic reconciliation"), 30_000)
    }
    try {
      unwatch = wsClient().watchEntityEvents({
        onEvent: (e) => {
          if (!alive) return
          setState("live")
          const k = (e as { entityKey?: string }).entityKey?.toLowerCase()
          if (k && watched.has(k)) cb.current(`${e.type} event`)
        },
        onError: () => alive && startFallback(),
      })
      // The stream is chain-wide, so any event proves the socket is up. Busy testnet: seconds.
      window.setTimeout(() => alive && setState((s) => (s === "connecting" ? "fallback" : s)), 20_000)
    } catch {
      startFallback()
    }
    const reconcile = window.setInterval(() => cb.current("periodic reconciliation"), 60_000)
    return () => {
      alive = false
      unwatch?.()
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer)
      window.clearInterval(reconcile)
    }
  }, [keyList])
  return state
}
