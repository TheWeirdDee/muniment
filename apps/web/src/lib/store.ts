/**
 * Tiny persistent stores on top of localStorage + useSyncExternalStore. Storage can be unavailable
 * (private windows, blocked site data), so every access is guarded and the app keeps working in
 * memory for the session.
 */
import { useSyncExternalStore } from "react"

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function createStore<T>(key: string, initial: T, validate: (v: unknown) => T | null) {
  let state: T = initial
  let persisted = true
  const raw = typeof window === "undefined" ? null : readStorage(key)
  if (raw !== null) {
    try {
      state = validate(JSON.parse(raw)) ?? initial
    } catch {
      state = initial
    }
  }
  const listeners = new Set<() => void>()
  const emit = () => {
    for (const l of listeners) l()
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return
      try {
        state = e.newValue === null ? initial : validate(JSON.parse(e.newValue)) ?? initial
      } catch {
        state = initial
      }
      emit()
    })
  }
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next
      persisted = writeStorage(key, JSON.stringify(state))
      emit()
    },
    persisted: () => persisted,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    use(): T {
      return useSyncExternalStore(this.subscribe, this.get, this.get)
    },
  }
}
