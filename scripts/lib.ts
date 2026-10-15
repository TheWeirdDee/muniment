/**
 * Shared helpers for Muniment's operator scripts (seeding, probes, proof campaign, measurements).
 * Keys come from .env (never committed). Every script writes machine-readable evidence under
 * evidence/ and never edits earlier evidence files.
 */
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { politeHttp } from "muniment-query"
import { webSocket } from "viem"
import { privateKeyToAccount } from "viem/accounts"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

export type Role = "PUBLISHER" | "RENEWER" | "REVIEWER" | "STRANGER"

export function rpcUrl(): string {
  return process.env.ARKIV_RPC_URL || tiramisu.rpcUrls.default.http[0]
}

export const publicClient = createPublicClient({ chain: tiramisu, transport: politeHttp(rpcUrl(), { concurrency: 1, attempts: 12, maxWaitMs: 12 * 60_000, onThrottle: (i) => console.log(`  … rate limited on ${i.method}, waiting ${Math.ceil(i.waitMs / 1000)} s`) }) })

export function wsClient() {
  return createPublicClient({ chain: tiramisu, transport: webSocket(process.env.ARKIV_WS_URL || tiramisu.rpcUrls.default.webSocket[0]) })
}

export function wallet(role: Role) {
  const key = process.env[`${role}_KEY`]
  if (!key) throw new Error(`${role}_KEY missing from environment (.env)`)
  const account = privateKeyToAccount(key as `0x${string}`)
  return createWalletClient({ chain: tiramisu, transport: politeHttp(rpcUrl(), { concurrency: 1, attempts: 12, maxWaitMs: 12 * 60_000 }), account })
}

export function address(role: Role): `0x${string}` {
  const key = process.env[`${role}_KEY`]
  if (!key) throw new Error(`${role}_KEY missing`)
  return privateKeyToAccount(key as `0x${string}`).address
}

export type Outcome = "pass" | "fail" | "unsupported" | "blocked"

export type EvidenceItem = {
  id: string
  title: string
  expected: string
  observed: string
  outcome: Outcome
  txHashes?: string[]
  entityKeys?: string[]
  data?: Record<string, unknown>
  at: string
}

export class Evidence {
  items: EvidenceItem[] = []
  private file: string
  private extra: Record<string, unknown> = {}
  constructor(readonly name: string) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    this.file = join(ROOT, "evidence", `${name}-${stamp}.json`)
  }

  record(item: Omit<EvidenceItem, "at">) {
    const full = { ...item, at: new Date().toISOString() }
    this.items.push(full)
    const mark = { pass: "PASS", fail: "FAIL", unsupported: "UNSUPPORTED", blocked: "BLOCKED" }[item.outcome]
    console.log(`[${mark}] ${item.id} ${item.title}\n        expected: ${item.expected}\n        observed: ${item.observed}`)
    if (item.txHashes?.length) console.log(`        tx: ${item.txHashes.join(", ")}`)
    // Written after every step so an interrupted run still leaves its partial record.
    this.write({ ...this.extra, partial: true })
  }

  save(extra: Record<string, unknown> = {}) {
    this.extra = extra
    return this.write({ ...extra, partial: false })
  }

  private write(extra: Record<string, unknown>) {
    const file = this.file
    mkdirSync(dirname(file), { recursive: true })
    const body = {
      name: this.name,
      savedAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        sdk: "@arkiv-network/sdk@0.8.1",
        viem: "2.57.7",
        rpc: rpcUrl().replace(/\/[A-Za-z0-9_-]{20,}$/, "/<redacted-key>"),
        chainId: tiramisu.id,
      },
      ...extra,
      summary: Object.fromEntries(
        (["pass", "fail", "unsupported", "blocked"] as const).map((o) => [o, this.items.filter((i) => i.outcome === o).length]),
      ),
      items: this.items,
    }
    writeFileSync(file, `${JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)}\n`)
    if (extra.partial === false) console.log(`\nEvidence written to ${file}`)
    return file
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Poll with bounded attempts and exponential backoff. Returns null on timeout, never a fake value. */
export async function poll<T>(fn: () => Promise<T | null>, opts: { timeoutMs: number; startMs?: number; maxMs?: number }): Promise<T | null> {
  const deadline = Date.now() + opts.timeoutMs
  let delay = opts.startMs ?? 250
  while (Date.now() < deadline) {
    try {
      const v = await fn()
      if (v !== null) return v
    } catch {
      // transient read failure: keep polling until the deadline
    }
    await sleep(delay)
    delay = Math.min(delay * 1.6, opts.maxMs ?? 4000)
  }
  return null
}

export function errorText(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string }
  return (e.shortMessage || e.message || String(err)).split("\n")[0].slice(0, 300)
}
