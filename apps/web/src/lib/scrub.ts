/**
 * Defence-in-depth scrubber for the one free-text field on the publish form. It catches common
 * identifier shapes; it cannot recognise every name or identifying context, which is why the publish
 * surface only accepts templated synthetic content in the first place.
 */
export type ScrubHit = { kind: string; sample: string }

const RULES: { kind: string; re: RegExp }[] = [
  { kind: "email address", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { kind: "Aadhaar-like number", re: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { kind: "PAN-like identifier", re: /\b[A-Z]{5}\d{4}[A-Z]\b/gi },
  { kind: "phone number", re: /(?:\+?\d{1,3}[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b|\b\d{3}[\s-]\d{3}[\s-]\d{4}\b/g },
  { kind: "postal code", re: /\b\d{3}\s?\d{3}\b/g },
  { kind: "street address", re: /\b(house|flat|plot|door)\s*(no\.?|number)?\s*\d+|\b\d+\s*,?\s*[a-z]+\s+(street|road|lane|nagar|colony|marg)\b/gi },
  { kind: "web link", re: /\bhttps?:\/\/\S+|\bwww\.\S+/gi },
]

export function scrub(text: string): ScrubHit[] {
  const hits: ScrubHit[] = []
  for (const r of RULES) {
    for (const m of text.matchAll(r.re)) hits.push({ kind: r.kind, sample: m[0].slice(0, 24) })
  }
  return hits
}
