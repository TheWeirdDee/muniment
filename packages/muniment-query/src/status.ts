/**
 * Derive what a reader should say about a reply from its linked records. Authority comes only from
 * on-chain creators the reader chose to trust; a review's self-description confers nothing.
 */
import type { DerivedStatus, Hex, Reply, Review } from "./schema.js"

export type StatusView = {
  status: DerivedStatus
  /** Trusted-reviewer statements that produced the status. */
  basis: Review[]
  /** Reviews from wallets the reader has not chosen to trust. Shown, never counted. */
  otherReviews: Review[]
  /** A correction from the original creator, if any (newest first). */
  supersededBy: Reply | null
  /** Corrections claimed by other wallets: displayed as proposals, not supersession. */
  proposedCorrections: Reply[]
}

const same = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export function deriveStatus(
  reply: Reply,
  linked: { reviews: Review[]; corrections: Reply[] },
  trustedReviewers: readonly Hex[],
): StatusView {
  const trusted = new Set(trustedReviewers.map((r) => r.toLowerCase()))
  const reviews = linked.reviews.filter((r) => r.reply === reply.key)
  const basis = reviews.filter((r) => r.creator && trusted.has(r.creator.toLowerCase()))
  const otherReviews = reviews.filter((r) => !basis.includes(r))
  const corrections = linked.corrections
    .filter((c) => c.corrects === reply.key && c.key !== reply.key)
    .sort((a, b) => Number((b.createdAtBlock ?? 0n) - (a.createdAtBlock ?? 0n)))
  const own = corrections.filter((c) => same(c.creator, reply.creator))
  const supersededBy = own[0] ?? null
  const proposedCorrections = corrections.filter((c) => !own.includes(c))
  let status: DerivedStatus = "unreviewed"
  if (supersededBy) status = "superseded"
  else if (basis.some((r) => r.status === "disputed")) status = "disputed"
  else if (basis.some((r) => r.status === "source-compared")) status = "source-compared"
  return { status, basis, otherReviews, supersededBy, proposedCorrections }
}

/** Days between filing and now for unanswered records: waiting time, never a response duration. */
export function elapsedDays(filedMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - filedMs) / 86_400_000))
}
