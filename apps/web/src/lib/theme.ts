import { useSyncExternalStore } from "react"
import { readStorage, writeStorage } from "./store"

/** Dark is the default for a new visitor; an explicitly saved choice always wins. */
export type ThemeChoice = "dark" | "light" | "system"
const KEY = "muniment.theme"

let choice: ThemeChoice = (() => {
  const v = typeof window === "undefined" ? null : readStorage(KEY)
  return v === "light" || v === "system" ? v : "dark"
})()
const listeners = new Set<() => void>()

export function resolvedTheme(): "dark" | "light" {
  if (choice === "system") return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
  return choice
}

function apply() {
  const r = resolvedTheme()
  document.documentElement.setAttribute("data-theme", r)
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", r === "dark" ? "#111114" : "#f0eadc")
}

export function setTheme(next: ThemeChoice) {
  choice = next
  writeStorage(KEY, next)
  apply()
  for (const l of listeners) l()
}

export function initTheme() {
  apply()
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (choice === "system") {
      apply()
      for (const l of listeners) l()
    }
  })
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => choice,
    () => choice,
  )
}
