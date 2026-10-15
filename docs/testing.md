# Testing and evidence

Every claim maps to the kind of evidence that can support it: chain transactions for permissions and atomicity, browser tests for user flows, unit tests for logic, screenshots for appearance only. Machine-readable results are in [`evidence/`](../evidence/). A failed run is never edited; a later passing run is recorded separately.

## Wallets

| Role | Address | Funding |
|---|---|---|
| Publisher | `0x817574740F413816636FAE23064607084e2C0604` | 10 GLM from the faucet (claimed by the project owner) |
| Renewer | `0xe0e47735c1add1390E03766D7Bd06eC913485DE7` | 10 GLM from the faucet |
| Reviewer | `0xeC5C622d43217c5DA7C006be11909c0Fb6fFf5C1` | 10 GLM from the faucet |
| Stranger | `0x5F2b31286708083Aa5D097bD89d5b3F48DD6cBC9` | 1 GLM transferred from the reviewer (`0xa737…3e65`) |

All four are team-controlled test wallets on Tiramisu only.

## Seeded corpus

`npm run seed` on 15 Oct 2026: **80 entities in 12 transactions**. That is 41 replies (39 sealed, 2 publisher-held), 19 exemption relations, 9 appeals and 11 reviews. Every key and transaction is in [`evidence/manifest.json`](../evidence/manifest.json). It was read back through `muniment-query` with 41 replies, 0 decode issues and a complete scan (`scripts/check-live.ts`).

## Live proof campaign: `npm run proof`

Run `run-1792104529024`, 15 Oct 2026, starting at block 627,382. Result: **14 pass, 0 fail.** File: [`evidence/proof-2026-10-15T22-48-49-010Z.json`](../evidence/proof-2026-10-15T22-48-49-010Z.json).

| ID | Claim | Observed | Transaction(s) |
|---|---|---|---|
| P1 | Flags are set as requested; one entity is sealed to `0x…dEaD` in its creating batch; predicted keys match | A raw 3, B raw 1, S owner `0x…dEaD`, creator = publisher | `0x02eb91c7…63ac` |
| P2a | A different wallet extends a permissionless entity | expiry 638,185 → 649,047, read back directly | `0x54e50a19…ee09` |
| P2b | The same wallet cannot extend a comparable owner-only entity | rejected `NotOwner` at pre-flight; expiry unchanged | — (rejected before broadcast) |
| P3a | A stranger cannot patch | rejected `NotOwner` | — |
| P3b | The owner cannot patch a read-only entity | rejected `ReadOnlyEntity` | — |
| P3c | A stranger cannot delete | rejected `NotOwner` | — |
| P3d | The original publisher cannot delete a sealed entity | rejected `NotOwner` (owner `0x…dEaD`); still readable | — |
| P3e | A stranger can still extend a sealed entity | new expiry 649,057 | `0xde2483de…e169` |
| P3f | Escape path on an **unsealed** read-only entity: the owner transfers, the new owner deletes | both succeeded; entity gone | `0x12847052…734b`, `0x1263430e…02f3` |
| P4a | Deliberate atomic failure: valid extension + receipt create + invalid extension | **mined and reverted**; valid entity's expiry unchanged; no receipt exists | `0x9771cb77…17d6` |
| P5 | A genuine receipt verifies; a standalone forged receipt is excluded | genuine: verified, renewer = renewer wallet; forged: "unverified: the same transaction did not extend the named reply" | `0x298f2be6…fd36` (genuine), `0x4d0c44e0…e1b` (forged) |
| P6 | An extension can never shorten a lifetime | rejected `ExpiryNotExtended` | — |
| P7 | Plain GLM transfer between EOAs | success (docs say otherwise; see friction #4) | `0x96ddbc46…b268` |
| P8 | A short-lived control really expires | live at block 627,483 (expires 627,526); gone at head 627,527: `getEntity` throws, query empty | `0xbd279c28…2b48` |

Rejections marked "—" were stopped by the node during pre-flight estimation, so nothing was broadcast. P4a deliberately set explicit gas to skip pre-flight, so the failure is on chain.

**Interrupted runs, disclosed:** two earlier attempts (same day) stalled after broadcasting their first batch, because the public endpoint's query budget was exhausted and receipt polling retried silently (friction #1 and #2). The first left no evidence file; the second was stopped and replaced by the run above. Their orphaned control entities are labelled `kind = "control"` and expire within 6–12 hours.

## Latency: `npm run measure`

See [`SPONSOR_BEHAVIOUR.md`](../SPONSOR_BEHAVIOUR.md) for the measured runs and method.

## Unit tests: `npm test`

42 tests across 6 files (Vitest), covering:

- schema validation (no-reply rules, dates, types, unsafe URLs, correction consistency, size limits, versions, namespace);
- query building (escaping, typed ranges, creator clauses, bounds);
- renewal planning (never shorten, permissions, expired, atomic units, batch packing);
- receipt verification (genuine, forged, borrowed transaction, wrong reply, overstated expiry, reverted transaction, sender mismatch, foreign logs);
- collection export/import (notes excluded, malformed files, dedupe);
- calldata equivalence with the SDK.

The equivalence test and the verification tests use test doubles (a stub transport, hand-built receipts). They prove logic, not live behaviour; the proof campaign covers that.

## Browser tests: `npx playwright test`

[`tests/e2e/site.spec.ts`](../tests/e2e/site.spec.ts) covers:

- every route on direct load: status 200, no console errors, no horizontal overflow;
- prerendered metadata, a real 404, invalid and missing keys;
- navigation (desktop "More" menu and mobile menu), back and forward;
- theme persistence, URL filter state, the settings and wallet dialogs;
- the publish scrubber, collection import/export;
- axe WCAG 2.1 AA checks on six routes.

[`tests/e2e/live.spec.ts`](../tests/e2e/live.spec.ts) covers live data:

- a real landing record, the archive count of refused replies and range filters;
- sealed, disputed, corrected and unsealed record states;
- the **standalone reader opened from disk with the main site's origin blocked**, and the separately hosted dashboard;
- a rejected wallet signature;
- with `E2E_SIGN=1`, a real UI renewal signed by the renewer wallet through an injected EIP-1193 test wallet. The key stays in the Node process; the transaction is real.

Both projects run: desktop 1440×900 and phone 390×844. Results go to `evidence/e2e-results.json`. The latest production run is recorded in [`docs/submission.md`](submission.md#verification-status).

## Not tested

- No independent usability session took place.
- A second, independent RPC provider was not tested; only the public Tiramisu endpoint was.
- Real wallet extensions (MetaMask, Rabby) were not driven in automation. The injected test wallet exercises the same EIP-1193 and EIP-6963 paths.
