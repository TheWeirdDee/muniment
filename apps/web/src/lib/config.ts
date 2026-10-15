import { TIRAMISU, type Hex } from "muniment-query"

const list = (v: string | undefined, fallback: string[]): Hex[] =>
  (v ? v.split(",") : fallback).map((s) => s.trim()).filter((s) => /^0x[0-9a-fA-F]{40}$/.test(s)) as Hex[]

/**
 * Wallets this deployment trusts by default. They are team-controlled test wallets, labelled as such
 * everywhere they appear. Readers can widen the view to every wallet that writes the namespace.
 */
export const TRUSTED_PUBLISHERS = list(import.meta.env.VITE_TRUSTED_PUBLISHERS, ["0x817574740F413816636FAE23064607084e2C0604"])
export const TRUSTED_REVIEWERS = list(import.meta.env.VITE_TRUSTED_REVIEWERS, ["0xeC5C622d43217c5DA7C006be11909c0Fb6fFf5C1"])

export const KNOWN_WALLETS: Record<string, string> = {
  "0x817574740f413816636fae23064607084e2c0604": "Muniment test publisher (team wallet)",
  "0xe0e47735c1add1390e03766d7bd06ec913485de7": "Muniment test renewer (team wallet)",
  "0xec5c622d43217c5da7c006be11909c0fb6fff5c1": "Muniment test reviewer (team wallet)",
  "0x5f2b31286708083aa5d097bd89d5b3f48dd6cbc9": "Muniment permission-test wallet (team wallet)",
  "0x000000000000000000000000000000000000dead": "Conventional burn address used for sealing (assumed to have no usable key)",
}

export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://muniment-archive.vercel.app"
export const DASHBOARD_URL = (import.meta.env.VITE_DASHBOARD_URL as string | undefined) ?? "https://muniment-insights.vercel.app"
export const REPO_URL = "https://github.com/TheWeirdDee/muniment"
export const REPO_BLOB = `${REPO_URL}/blob/main`

export const DEFAULT_RPC = TIRAMISU.httpRpc
export const DEFAULT_WS = TIRAMISU.wsRpc
