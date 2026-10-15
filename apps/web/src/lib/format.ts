import { BLOCK_SECONDS } from "muniment-query"
import { KNOWN_WALLETS } from "./config"

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const DATETIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
})

/** Calendar dates stored as UTC midnight are always shown in UTC so they never shift by a day. */
export function formatDate(ms: number | null): string {
  return ms === null ? "Not recorded" : DATE.format(new Date(ms))
}

export function formatDateTime(ms: number): string {
  return DATETIME.format(new Date(ms))
}

export function shortHex(h: string | null | undefined, head = 6, tail = 4): string {
  if (!h) return "unknown"
  return h.length <= head + tail + 2 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`
}

export function walletLabel(address: string | null | undefined): string | null {
  return address ? KNOWN_WALLETS[address.toLowerCase()] ?? null : null
}

export function sameAddress(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

export type HeadAnchor = { block: bigint; timeMs: number }

/** Approximate wall-clock time of a block. The UI always labels this as approximate. */
export function blockToMs(block: bigint, anchor: HeadAnchor): number {
  return anchor.timeMs + Number(block - anchor.block) * BLOCK_SECONDS * 1000
}

export function blocksToDuration(blocks: bigint): string {
  const seconds = Number(blocks) * BLOCK_SECONDS
  if (seconds <= 0) return "0 minutes"
  const days = seconds / 86_400
  if (days >= 2) return `${Math.floor(days)} days`
  const hours = seconds / 3_600
  if (hours >= 2) return `${Math.floor(hours)} hours`
  return `${Math.max(1, Math.round(seconds / 60))} minutes`
}

export function formatBlock(b: bigint | null | undefined): string {
  return b === null || b === undefined ? "unknown" : b.toLocaleString("en-GB")
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`
}
