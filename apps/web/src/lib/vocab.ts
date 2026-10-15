/** Display vocabulary for the synthetic corpus's controlled values. Unknown values still render. */
export const AUTHORITIES: { slug: string; name: string }[] = [
  { slug: "ravipur-mc", name: "Ravipur Municipal Corporation" },
  { slug: "sundarvan-pwd", name: "Public Works Department, Sundarvan" },
  { slug: "kestrel-dp", name: "Kestrel District Panchayat" },
  { slug: "harbourline-ua", name: "Harbourline Urban Authority" },
  { slug: "meridia-rrc", name: "Rural Roads Cell, Meridia" },
]

export const JURISDICTIONS = [
  { slug: "sundarvan", name: "Sundarvan (fictional state)" },
  { slug: "meridia", name: "Meridia (fictional territory)" },
]

export const TOPICS = [
  { slug: "roads", name: "Road resurfacing" },
  { slug: "drainage", name: "Storm-water drainage" },
  { slug: "streetlights", name: "Street lighting" },
  { slug: "contracts", name: "Contract awards" },
  { slug: "bridges", name: "Bridge maintenance" },
]

export const SECTIONS = [
  { slug: "8(1)(d)", name: "8(1)(d) commercial confidence" },
  { slug: "8(1)(e)", name: "8(1)(e) fiduciary relationship" },
  { slug: "8(1)(h)", name: "8(1)(h) impede investigation" },
  { slug: "8(1)(j)", name: "8(1)(j) personal information" },
]

export const authorityName = (slug: string) => AUTHORITIES.find((a) => a.slug === slug)?.name ?? slug
