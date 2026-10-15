/**
 * The synthetic demo corpus. Every authority, jurisdiction, reference number and figure here is
 * invented for the Muniment hackathon demo. No real person, office, document or personal data is
 * represented. Dates inside the documents are part of the fiction; Arkiv's own block timestamps
 * record when each entity was actually published.
 */

export type Authority = { slug: string; name: string; jurisdiction: string; jurisdictionName: string; prefix: string }

export const AUTHORITIES: Authority[] = [
  { slug: "ravipur-mc", name: "Ravipur Municipal Corporation (synthetic)", jurisdiction: "sundarvan", jurisdictionName: "Sundarvan (fictional state)", prefix: "RMC" },
  { slug: "sundarvan-pwd", name: "Public Works Department, Sundarvan (synthetic)", jurisdiction: "sundarvan", jurisdictionName: "Sundarvan (fictional state)", prefix: "SPWD" },
  { slug: "kestrel-dp", name: "Kestrel District Panchayat (synthetic)", jurisdiction: "sundarvan", jurisdictionName: "Sundarvan (fictional state)", prefix: "KDP" },
  { slug: "harbourline-ua", name: "Harbourline Urban Authority (synthetic)", jurisdiction: "meridia", jurisdictionName: "Meridia (fictional territory)", prefix: "HUA" },
  { slug: "meridia-rrc", name: "Rural Roads Cell, Meridia (synthetic)", jurisdiction: "meridia", jurisdictionName: "Meridia (fictional territory)", prefix: "MRRC" },
]

export const TOPICS = {
  roads: "Road resurfacing",
  drainage: "Storm-water drainage",
  streetlights: "Street lighting",
  contracts: "Contract awards",
  bridges: "Bridge maintenance",
} as const

export type Topic = keyof typeof TOPICS
export type Outcome = "granted" | "partial" | "denied" | "transferred" | "no-reply"

export type CorpusReply = {
  id: string
  authority: Authority
  topic: Topic
  outcome: Outcome
  filed: string
  replied: string | null
  title: string
  question: string
  answer: string | null
  exemptions: string[]
  lifetimeDays: number
  /** Archive records are sealed (ownership sent to the burn address 0x…dEaD) unless false. */
  sealed: boolean
  sourceUrl: boolean
  appeals: { stage: "first-appeal" | "second-appeal"; filed: string; outcome: "pending" | "allowed" | "dismissed" | "remanded"; grounds: string; decision: string | null }[]
  review: { status: "source-compared" | "disputed"; method: string; limitations: string } | null
  /** If set, this reply corrects the reply with this corpus id. */
  corrects?: { id: string; reason: string }
}

const WARDS = ["Ward 2", "Ward 4", "Ward 7", "Ward 9", "Ward 11", "Ward 13", "Ward 15", "Ward 18"]

const QUESTIONS: Record<Topic, (place: string, fy: string) => string> = {
  roads: (p, fy) => `Please provide (a) the sanctioned budget, (b) the amount spent and (c) the list of work orders for road resurfacing in ${p} during ${fy}, with the length of road covered under each work order.`,
  drainage: (p, fy) => `Please provide the estimates, tender documents and completion certificates for storm-water drain works in ${p} during ${fy}, and the amount paid against each.`,
  streetlights: (p, fy) => `Please state the number of street lights installed and repaired in ${p} during ${fy}, the contractor responsible, and the total amount paid.`,
  contracts: (p, fy) => `Please provide the list of contracts above 50 lakh awarded for civil works in ${p} during ${fy}, the number of bids received for each, and the name of the successful bidder firm.`,
  bridges: (p, fy) => `Please provide the most recent structural inspection reports and maintenance expenditure for bridges in ${p} during ${fy}.`,
}

const ANSWERS: Record<Topic, (place: string, fy: string, n: number) => string> = {
  roads: (p, fy, n) => `For ${fy}, the sanctioned budget for road resurfacing in ${p} was ${(3 + (n % 5) * 0.7).toFixed(1)} crore. Expenditure to date is ${(2 + (n % 4) * 0.6).toFixed(1)} crore across ${4 + (n % 6)} work orders covering ${(6 + (n % 7) * 1.3).toFixed(1)} km. The work-order list is enclosed as Annexure A (synthetic).`,
  drainage: (p, fy, n) => `${3 + (n % 4)} drain works were taken up in ${p} in ${fy}. ${2 + (n % 3)} are complete and certified; the remainder are in progress. Payments released total ${(1.1 + (n % 5) * 0.4).toFixed(1)} crore. Copies of estimates and certificates are enclosed (synthetic).`,
  streetlights: (p, fy, n) => `${120 + n * 7} new LED fittings were installed and ${300 + n * 11} repaired in ${p} during ${fy} under an annual maintenance contract. Total paid: ${(38 + n * 2.5).toFixed(1)} lakh (synthetic figures).`,
  contracts: (p, fy, n) => `${2 + (n % 5)} contracts above 50 lakh were awarded in ${p} during ${fy}. Bid counts ranged from ${1 + (n % 2)} to ${3 + (n % 4)}. The list with successful bidder firms is enclosed (synthetic firm names).`,
  bridges: (p, fy, n) => `The last structural inspection of the ${2 + (n % 3)} bridges in ${p} was carried out in ${fy}. Maintenance expenditure was ${(12 + n * 1.7).toFixed(1)} lakh. Inspection summaries are enclosed (synthetic).`,
}

const DENIALS: Record<string, string> = {
  "8(1)(d)": "Information sought is exempt under Section 8(1)(d) as it includes commercial details of bidders whose disclosure would harm their competitive position.",
  "8(1)(j)": "Portions relating to individual contractors' staff are personal information exempt under Section 8(1)(j).",
  "8(1)(h)": "The matter is under departmental vigilance inquiry; disclosure would impede the process of investigation. Exempt under Section 8(1)(h).",
  "8(1)(e)": "Inspection reports were received in a fiduciary capacity from a consultant. Exempt under Section 8(1)(e).",
}

type Row = [authorityIndex: number, topic: Topic, outcome: Outcome, filed: string, responseDays: number | null, exemptions: string[], lifetimeDays: number]

// 40 rows. Response days are computed from filed + replied; no-reply rows carry no reply date.
const ROWS: Row[] = [
  [0, "roads", "granted", "2025-11-03", 27, [], 180],
  [0, "roads", "partial", "2025-11-18", 34, ["8(1)(d)"], 180],
  [0, "drainage", "granted", "2025-12-01", 21, [], 90],
  [0, "streetlights", "granted", "2026-01-12", 18, [], 180],
  [0, "contracts", "denied", "2026-01-20", 30, ["8(1)(d)", "8(1)(j)"], 180],
  [0, "roads", "no-reply", "2026-02-02", null, [], 30],
  [0, "bridges", "partial", "2026-02-15", 41, ["8(1)(e)"], 180],
  [0, "drainage", "transferred", "2026-03-04", 6, [], 45],
  [1, "roads", "granted", "2025-10-22", 29, [], 180],
  [1, "contracts", "denied", "2025-11-09", 30, ["8(1)(h)"], 180],
  [1, "bridges", "granted", "2025-12-14", 25, [], 180],
  [1, "roads", "partial", "2026-01-06", 37, ["8(1)(d)"], 90],
  [1, "drainage", "no-reply", "2026-01-28", null, [], 180],
  [1, "contracts", "partial", "2026-02-19", 30, ["8(1)(d)", "8(1)(j)"], 180],
  [1, "streetlights", "granted", "2026-03-10", 15, [], 21],
  [1, "bridges", "denied", "2026-03-25", 28, ["8(1)(e)"], 180],
  [2, "roads", "granted", "2025-11-11", 30, [], 180],
  [2, "drainage", "granted", "2025-12-08", 26, [], 180],
  [2, "contracts", "no-reply", "2026-01-05", null, [], 45],
  [2, "roads", "denied", "2026-01-22", 30, ["8(1)(h)", "8(1)(j)"], 180],
  [2, "streetlights", "partial", "2026-02-11", 44, ["8(1)(j)"], 90],
  [2, "bridges", "transferred", "2026-03-02", 4, [], 180],
  [2, "roads", "granted", "2026-03-30", 22, [], 30],
  [2, "drainage", "denied", "2026-04-14", 30, ["8(1)(d)"], 180],
  [3, "contracts", "granted", "2025-10-28", 19, [], 180],
  [3, "roads", "partial", "2025-11-25", 33, ["8(1)(d)"], 180],
  [3, "streetlights", "no-reply", "2025-12-19", null, [], 180],
  [3, "drainage", "granted", "2026-01-15", 30, [], 21],
  [3, "bridges", "denied", "2026-02-04", 30, ["8(1)(e)", "8(1)(h)"], 180],
  [3, "contracts", "transferred", "2026-02-26", 5, [], 90],
  [3, "roads", "granted", "2026-03-18", 24, [], 180],
  [3, "streetlights", "partial", "2026-04-07", 52, ["8(1)(j)"], 180],
  [4, "roads", "granted", "2025-11-06", 31, [], 180],
  [4, "bridges", "partial", "2025-12-03", 38, ["8(1)(e)"], 180],
  [4, "contracts", "denied", "2026-01-09", 30, ["8(1)(d)"], 45],
  [4, "roads", "no-reply", "2026-02-09", null, [], 180],
  [4, "drainage", "granted", "2026-03-06", 17, [], 180],
  [4, "roads", "transferred", "2026-03-27", 3, [], 180],
  [4, "streetlights", "no-reply", "2026-04-20", null, [], 30],
  [4, "contracts", "granted", "2026-05-04", 28, [], 180],
]

const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10)

function fyOf(iso: string): string {
  const [y, m] = iso.split("-").map(Number)
  const start = m >= 4 ? y - 1 : y - 2
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`
}

export function buildCorpus(): CorpusReply[] {
  const out: CorpusReply[] = ROWS.map(([ai, topic, outcome, filed, days, exemptions, lifetimeDays], n) => {
    const a = AUTHORITIES[ai]
    const place = a.jurisdiction === "meridia" ? ["Harbour North", "Saltmarsh", "Eastgate", "Long Quay"][n % 4] : WARDS[n % WARDS.length]
    const fy = fyOf(filed)
    const replied = days === null ? null : addDays(filed, days)
    let answer: string | null = null
    if (outcome === "granted") answer = ANSWERS[topic](place, fy, n)
    if (outcome === "partial") answer = `${ANSWERS[topic](place, fy, n)} Some details are withheld: ${exemptions.map((e) => DENIALS[e]).join(" ")}`
    if (outcome === "denied") answer = `The request cannot be met. ${exemptions.map((e) => DENIALS[e]).join(" ")} The applicant may file a first appeal within 30 days.`
    if (outcome === "transferred") answer = `The information is held by another public authority. The application has been transferred under Section 6(3) to the relevant office, which will reply directly.`
    const appeals: CorpusReply["appeals"] = []
    if (outcome === "denied" || outcome === "no-reply") {
      if (n % 2 === 0 || outcome === "no-reply") {
        const base = replied ?? addDays(filed, 35)
        appeals.push({
          stage: "first-appeal",
          filed: addDays(base, 12),
          outcome: n % 3 === 0 ? "allowed" : n % 3 === 1 ? "pending" : "dismissed",
          grounds: outcome === "no-reply"
            ? "No reply was received within the statutory period. The applicant requests that the information be supplied."
            : "The exemption has been applied to the whole record. Severable portions should be disclosed under Section 10.",
          decision: n % 3 === 1 ? null : n % 3 === 0 ? "Appeal allowed in part. Severable expenditure figures to be supplied within 15 days (synthetic decision)." : "Appeal dismissed; the exemption is upheld (synthetic decision).",
        })
      }
    }
    return {
      id: `r${String(n + 1).padStart(2, "0")}`,
      authority: a,
      topic,
      outcome,
      filed,
      replied,
      title: `${TOPICS[topic]}, ${place}, ${fy} (synthetic)`,
      question: QUESTIONS[topic](place, fy),
      answer,
      exemptions,
      lifetimeDays,
      sealed: n !== 3 && n !== 17,
      sourceUrl: n % 5 === 0,
      appeals,
      review: n % 4 === 0 ? { status: "source-compared", method: "Compared the published text field by field with the synthetic source fixture in the Muniment repository (corpus/sources).", limitations: "Synthetic fixture only. Confirms the archive matches the fixture, not that any authority issued it." } : null,
    }
  })
  // A disputed example: the reviewer reports a mismatch against the fixture.
  out[10].review = {
    status: "disputed",
    method: "Compared the expenditure figure with the synthetic source fixture.",
    limitations: "Synthetic fixture only. The dispute concerns the stated figure, not the authority's identity.",
  }
  out[10].answer = `${out[10].answer} [Deliberate demo discrepancy: the synthetic source fixture states a different total.]`
  // A corrected example: r41 corrects r17 with an explicit link; r17 stays immutable.
  const original = out[16]
  out.push({
    ...original,
    id: "r41",
    title: `${original.title.replace(" (synthetic)", "")} — corrected (synthetic)`,
    answer: `${original.answer} Correction: the road length covered is restated after the original upload transposed two digits (synthetic).`,
    appeals: [],
    review: null,
    sealed: true,
    corrects: { id: original.id, reason: "The original upload transposed two digits in the road length. This record restates the figure; the original remains unchanged." },
  })
  return out
}

export function sourceFixture(r: CorpusReply): string {
  return [
    `# ${r.title}`,
    "",
    "> Synthetic source fixture for the Muniment hackathon demo. Not a real government document.",
    "",
    `- Authority: ${r.authority.name}`,
    `- Jurisdiction: ${r.authority.jurisdictionName}`,
    `- Reference: ${r.authority.prefix}/RTI/${r.filed.slice(0, 4)}/${r.id.toUpperCase()}`,
    `- Filed: ${r.filed}`,
    `- Replied: ${r.replied ?? "no reply recorded"}`,
    `- Outcome: ${r.outcome}`,
    `- Exemptions cited: ${r.exemptions.join(", ") || "none"}`,
    "",
    "## Question",
    "",
    r.question,
    "",
    "## Reply",
    "",
    r.id === "r11" ? (r.answer ?? "").replace(/\[Deliberate demo discrepancy[^\]]*\]/, "").replace(/(\d+\.\d) lakh/, "99.9 lakh") : (r.answer ?? "No reply recorded."),
    "",
  ].join("\n")
}
