# Requirements → evidence

Status: **met**, **partial** or **not met**, each with the evidence. Updated with each verification run.

## Hackathon gates (docs/scoring-rubric.md)

| Gate | Status | Evidence |
|---|---|---|
| Public deployment usable without access | met | https://muniment-archive.vercel.app (Vercel Git build; `/version.json` shows the source commit) |
| Reproducible steps and exact query | met | [`arkiv/schema.md`](../arkiv/schema.md#reproduce-with-curl), [`docs/submission.md`](submission.md) answer 8 |
| Public MIT repo with setup | met | [`LICENSE`](../LICENSE), [`README.md`](../README.md#quick-start) |
| `/arkiv/schema.md` | met | entity types, attributes, expiry per type, the queries the app runs |
| On-chain evidence: creating wallets | met | [`docs/testing.md`](testing.md#wallets), [`evidence/manifest.json`](../evidence/manifest.json) |
| `/arkiv/friction.md` | met | 14 entries with versions and repro scripts |
| Demo video ≤ 3 minutes | met | 1 min 44 s, recorded from production: https://github.com/TheWeirdDee/muniment/releases/download/demo-2026-10-16/muniment-demo.mp4 (renewal tx `0xe11c…48ce`, verified) |
| Every Devfolio question answered | drafted | [`docs/submission.md`](submission.md); a few personal answers are for the team |
| A track chosen | to submit | Censorship Resistance and Open Source (no Indian national on the team) |
| Built 9–18 Oct, pre-existing work disclosed | met | baseline `f2202e9` (README only); [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) |
| Evidence that survives expiry | met | transaction hashes in `evidence/`; demo records live until ≥ 5 Nov 2026 |

## PRD success criteria (§15)

| Criterion | Status | Evidence |
|---|---|---|
| A visitor finds a reply and understands source uncertainty without a wallet | met | archive and record pages; e2e "a sealed record shows provenance" |
| Another wallet renews and the lifetime is independently verifiable | met | proof P2a, P3e; UI renewal in the demo film (tx in `demo/out/scenes.json`) |
| Verified activity cannot be inflated by a forged receipt | met | proof P5; unit tests in `verify.test.ts` |
| A researcher can preserve, export and understand partial completion | met | collections export/import e2e; per-batch progress in `RenewDialog` |
| An independent reader queries live records without Muniment's origin | met | e2e "standalone reader works from disk with the main site blocked" |
| A separate dashboard consumes the public contract | met | https://muniment-insights.vercel.app, separate Vercel project and origin |
| Claims match demonstrated behaviour | met | [`docs/copy-audit.md`](copy-audit.md); sealing wording states its assumption |
| Evidence, deployment and instructions complete before submission | in progress | this file |

## Proof campaign (§14)

| PRD item | Status | Evidence |
|---|---|---|
| 1. Flags; owner and stranger update/delete; transfer paths | met | P1, P3a–P3f |
| 2. Another wallet extends; owner-only control rejects | met | P2a, P2b |
| 3. Atomic renewal and a deliberate atomic failure | met | P4a (mined revert); seed and renewal batches |
| 4. A forged receipt is excluded | met | P5 |
| 5. Reader with the main origin blocked | met | e2e live suite |
| 6. A short-lived control really expires | met | P8 |
| 7. Concurrent renewal, stale quote, rejected signature, reconnect, rate limits | partial | stale-quote check and rejected signature implemented and tested (e2e); rate limits observed and handled ([friction #1](../arkiv/friction.md)); concurrent renewal by two wallets and long WebSocket reconnects were not run as a scripted test |
| 8. Dashboard reproduces from contract and package | met | e2e dashboard test; `apps/dashboard` uses only `muniment-query` |
| 9. Synthetic-only publish boundary; accessible mobile flows | met | scrubber e2e; phone e2e project; axe checks |
| Latency, ≥ 5 runs per interval | met | [`SPONSOR_BEHAVIOUR.md`](../SPONSOR_BEHAVIOUR.md) (n = 5) |
| ~40 synthetic replies with appeal, dispute, correction | met | 41 replies, 9 appeals, 1 disputed, 1 corrected |
| Independent usability session | not met | not conducted |

## Design and copy brief

| ID | Status | Evidence |
|---|---|---|
| VIS-01…06, CPY-01…06, INT-01…02 | met | [`docs/copy-audit.md`](copy-audit.md); before/after screens in `evidence/screens/` |
