import { createStore } from "./store"
import { DEFAULT_RPC, DEFAULT_WS } from "./config"

export type Settings = {
  rpcUrl: string
  wsUrl: string
  /** Show entities from any wallet that uses the namespace, not only trusted publishers. */
  anyPublisher: boolean
}

const DEFAULTS: Settings = { rpcUrl: DEFAULT_RPC, wsUrl: DEFAULT_WS, anyPublisher: false }

const isUrl = (v: unknown, protocols: string[]) => {
  if (typeof v !== "string") return false
  try {
    return protocols.includes(new URL(v).protocol)
  } catch {
    return false
  }
}

export const settings = createStore<Settings>("muniment.settings.v1", DEFAULTS, (v) => {
  if (typeof v !== "object" || v === null) return null
  const o = v as Record<string, unknown>
  return {
    rpcUrl: isUrl(o.rpcUrl, ["https:"]) ? (o.rpcUrl as string) : DEFAULTS.rpcUrl,
    wsUrl: isUrl(o.wsUrl, ["wss:"]) ? (o.wsUrl as string) : DEFAULTS.wsUrl,
    anyPublisher: o.anyPublisher === true,
  }
})

export const DEFAULT_SETTINGS = DEFAULTS
