# Design reference notes

What was studied, what was taken, and what was deliberately not taken. Muniment's visual identity, copy and illustrations are original; no reference logo, wording, image or source code is reused.

## Sources inspected

| Reference | How | Result |
|---|---|---|
| milliseconds.ai (primary) | Playwright, 1440×900 and 390×844, full scroll | Loaded on both; desktop and mobile captures taken 15 Oct 2026 |
| m3.sineframe.com (secondary) | Playwright, same sizes | Loaded on both (the first mobile attempt timed out; retry succeeded) |
| Kage screenshots supplied by the user | Read as images | Used to confirm section order |
| A palette card supplied by the user (Moss #576238, Mustard #FFD95D, Eggshell #F0EADC) | Read as an image | Adopted as the brand palette (see below) |

Animation libraries used by the references were **not** verified; nothing here claims either site uses GSAP, Framer Motion or anything else.

## Observations → how Muniment uses them

| Observed in the reference | Muniment's interpretation |
|---|---|
| A compact two-line display headline on desktop, with the value statement and primary action visible above the fold | Hero "Public answers. / Worth keeping." in two deliberate lines (≥1100 px); the lede, primary action and scope note fit in the first viewport at common laptop heights |
| A clear text/visual split; the visual is a bounded, layered card composition | One bounded "stage": a Moss backing panel and an Eggshell record card, both carrying **real** record data read from Arkiv. Small rotations (−1.2°, +2.2°) only; flattened below 560 px |
| A slim dark header with few links and one bordered action | Three primary links plus a "More" menu, one settings control, one bordered action. Desktop shows links only; below 900 px a menu button only (never both) |
| Each section pairs one message with one structured visual | Each landing section pairs a short message with a flat, readable panel of live data (soonest-expiring records, provenance of the hero record, reader requirements) |
| A usable demo frame with operations list and request/response | Kept, but moved to Developers: a first-time reader doesn't need raw RPC on the landing page |
| Rules and spacing rather than boxes to structure a long page; a decisive closing band | Thin palette-derived rules; a single Mustard closing band with one concrete action |
| Secondary reference: calm paper surfaces, plain-spoken FAQ, code panels | Light theme on Eggshell; a plain-language FAQ; monospace panels for queries |

## Deliberately not taken

- The reference's purple, neon lime and peach (removed everywhere: UI tokens, logo, charts, OG image, reader, dashboard).
- Oversized decorative background lettering, a giant numeral, and the free-allowance pricing block.
- Heavy hard-shadow, strongly tilted "paper" cards on every row. Data panels, tables and forms stay flat.
- Illustrations that look like live results. Every panel that looks like data **is** live data, or says it is unavailable.

## Palette

| Token | Hex | Role | Pairing (measured contrast) |
|---|---|---|---|
| Canvas | `#111114` | dark background (default theme) | Eggshell text 15.7:1 |
| Moss | `#576238` | panels, step markers, light-theme accent fill | Eggshell text on Moss 5.5:1. Moss on black is 2.9:1, so Moss is never text on the dark canvas |
| Mustard | `#FFD95D` | primary action, accent text on dark, highlights, closing band | black on Mustard 13.8:1 |
| Eggshell | `#F0EADC` | text on dark, document surfaces, light-theme background | black on Eggshell 15.7:1; Moss-700 `#3D4527` on Eggshell 8.4:1 for links |

Borders and surfaces are Eggshell or black at low opacity, not new hues. Status (error, warning, success) always carries a text label, so it never relies on colour alone.

## Motion

- Sections enter with a 620 ms fade-and-rise on first intersection (an `IntersectionObserver` adds a class; CSS does the transition). Content is in the DOM and readable before and without the animation.
- The hero record card lifts 4 px and straightens slightly on hover or focus; the transform belongs to the inner card only, while the wrapper owns layout and the reveal.
- No continuous animation, scroll hijacking or animated "transaction" states.
- `prefers-reduced-motion: reduce` disables transitions and shows every element in its final position.

## Typography and layout

Archivo Variable (OFL) with its width axis: condensed 72% width for display, normal width for body; JetBrains Mono (OFL) for labels, keys and block numbers. Both self-hosted through Fontsource. One container (max 1240 px, gutter `clamp(1rem, 0.4rem + 2.6vw, 2.5rem)`), two-column splits that collapse to one column below 860–960 px, `min-width: 0` on grid children.
