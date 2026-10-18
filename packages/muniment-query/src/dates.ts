/** Strict UTC calendar date; Date.parse alone silently normalizes impossible dates. */
export function utcDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const ms = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(ms) && ms >= 0 && new Date(ms).toISOString().slice(0, 10) === value ? ms : null
}

export function inclusiveUtcRange(from: string, through: string) {
  const start = from ? utcDay(from) : null
  const end = through ? utcDay(through) : null
  if ((from && start === null) || (through && end === null)) throw new Error("Choose valid UTC calendar dates.")
  if (start !== null && end !== null && start > end) throw new Error("Filed from must not be later than Filed through.")
  return { from: start ?? undefined, through: end === null ? undefined : end + 86_400_000 - 1 }
}
