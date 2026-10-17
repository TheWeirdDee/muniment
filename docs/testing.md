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

## UI renewals from production

| When (UTC) | Record | Transaction | Result | Note |
|---|---|---|---|---|
| 16 Oct 00:0x | r03 | `0x34ca4d74f3378cd4447f4e66b7a524ea67d0a228c1180152b96aec9f7e6631a8` | success on chain (receipt create + extension, from the renewer) | **UI defect found:** the dialog showed "Failed" because the read-back after confirmation hit the RPC rate limit. Fixed in `0527cc7`: post-confirmation read problems now show "Confirmed on chain; reading it back is delayed". Receipt later verified by `scripts/verify-tx.ts`: **verified**, renewer = renewer wallet. |
| 16 Oct 01:5x | r03 | `0xe11c12e298cb2b7c95996fbe231c822e6a41fa2da863f242fa2928f1502e48ce` | dialog reached "Verified renewal"; `scripts/verify-tx.ts` independently: **verified**, extended r03 to block 8,407,095 | Recorded in the demo film |

## Latency: `npm run measure`

See [`SPONSOR_BEHAVIOUR.md`](../SPONSOR_BEHAVIOUR.md) for the measured runs and method.

## Unit tests: `npm test`

Latest real transaction results are recorded separately in [the 17 October signed campaign](transaction-campaign-2026-10-17.md). Four deployed-UI transactions passed complete chain reconciliation; the later simulated network-switch/stale-quote checks encountered public read quota and are not counted as passes.

51 package tests across 8 files (Vitest), covering:

- schema validation (no-reply rules, dates, types, unsafe URLs, correction consistency, size limits, versions, namespace);
- query building (escaping, typed ranges, creator clauses, bounds);
- renewal planning (never shorten, permissions, expired, atomic units, batch packing);
- receipt verification (genuine, forged, borrowed transaction, wrong reply, overstated expiry, reverted transaction, sender mismatch, foreign logs);
- collection export/import (notes excluded, malformed files, dedupe);
- calldata equivalence with the SDK.
- snapshot-pinned pagination and cancellable, bounded transport.

Web reconciliation and component regression tests run separately with `node node_modules/vitest/vitest.mjs run tests/components`. They do not count toward the package-suite inventory above. Dated historical run counts below describe those earlier revisions.

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

## Production browser run (16 Oct 2026, against https://muniment-archive.vercel.app)

| Suite | Result |
|---|---|
| `site.spec.ts`, desktop + phone (commit `f2455bb`) | 48 passed, 2 skipped (desktop-only controls on phone, by design), **2 failed on phone**: the archive filter test (filters are collapsed on phones; the test didn't open them) and axe `aria-prohibited-attr` on the hero stage (a label without a role). Both fixed in `f89cdae` / `13228ff` |
| Re-run of those two tests on phone (commit `13228ff`) | 2 passed |
| `live.spec.ts`, desktop (commit `13228ff`) | 7 passed: real landing record, archive count and range filters, sealed / disputed / corrected / unsealed states, the reader from disk with the main site blocked, the separately hosted dashboard |
| Rejected-signature test | **blocked**: the public endpoint's hourly query budget for this IP was exhausted by the test runs, so the quote never loaded. The app showed the rate-limit notice with the wait time, which is the intended behaviour. The rejection path is covered by the unit-level wallet error mapping; it was not re-run in production |
| Signed UI renewal | covered by the demo film: `0xe11c…48ce`, verified |

## Not tested

- No independent usability session took place.
- A second, independent RPC provider was not tested; only the public Tiramisu endpoint was.
- Real wallet extensions (MetaMask, Rabby) were not driven in automation. The injected test wallet exercises the same EIP-1193 and EIP-6963 paths.

## Correction verification, 16 October

The follow-up starts at `c4dabfe` and preserves the original evidence. `npm test` passed all 42 tests; workspace typechecking and both app builds passed. Production at `f1e0685` passed **35 desktop browser tests**, including rejected signatures and a 35-second browser network outage followed by a fresh record read; one optional signed-renewal test was skipped because the film already contains a verified real UI renewal.

The rejected-signature rerun initially found two defects: parent refreshes reset the renewal dialog, and Arkiv/viem wrappers hid provider error 4001. Stable key dependencies and walking the error cause chain fixed them. Both local and production regression checks then passed, including the assertion that no transaction was sent.

`node --env-file=.env --import tsx scripts/resilience.ts` checks chain 7738577 and balances before creating a separate synthetic control, then concurrently renews it from two wallets. The first run's **failed expectation** is preserved in `evidence/resilience-2026-10-16T08-24-14-631Z.json`: both transactions succeeded to the same absolute target. The corrected campaign passed in `evidence/resilience-2026-10-16T08-26-01-199Z.json`. Both receipts were independently confirmed successful in block 644704 (`evidence/final-chain.json`). This proves monotonic target coverage; it does not prove that every successful renewal adds marginal storage time. The app rereads snapshots before signing, but an in-flight race remains possible.

`node scripts/visual-audit.mjs https://muniment-archive.vercel.app evidence/visual-final` captured 216 route/width/theme checks, including the separate dashboard, at widths 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920. Desktop height was 720 px; reduced motion was enabled for these layout checks. Six checks found the reader footer URL overflowing on narrow screens. The original failing report remains intact. The reader fix at `125c042` was then verified on production at all nine widths in both themes: **18 passed, zero page overflow** (`evidence/reader-final/results.json`). Long form-field values scroll inside their inputs, as expected.

The normal-motion recording is `evidence/visual-final/motion/page@854557e84b2646fd97a338f3e62a296d.webm`. It records actual scrolling, section entrances and card hover. Screenshots alone are not evidence of smooth animation. Layout screenshots can include honest loading states; `home-1440-dark-motion-fold.png` separately captures a real loaded record with both hero actions visible at 1440×720.

The phone run passed 24 checks, including route loads, mobile navigation, collections, filters, publishing boundaries and all six axe checks. Two live-data assertions were blocked by the endpoint's per-IP budget (the archive reported a 1772-second wait); the serial live suite then skipped its remaining checks. These are not recorded as passes. Production correctly showed a rate-limit error rather than empty data or an expired record. Desktop tests had already passed those same live paths.

Public schema, friction report, evidence documentation, package documentation, MIT licence, package tarball, demo MP4 and captions all returned HTTP 200 in `evidence/release-check.json`. Both projects reported `source: vercel-git` and the pushed revision, establishing that their existing repository integration is active.

### Production publication follow-up

The stranger test wallet published an additional synthetic, user-published reply through the production page: transaction `0x3692206b22200de5597d1cade471150f462cc7cfa12167a9c0e8ba9c8fa9e295`, entity `0xc7ccf28706bdfc660d65f39c697c3e37418bad566f2fb18b6abea4381f13bb33`, block 647739. It is separate from the curated publisher's 41-record corpus. The browser showed confirmation but the query budget prevented readback; that browser test failed and is not counted as a pass. Standard Ethereum RPC independently confirmed success, flags 3 and ownership transfer to `0x…dEaD` in the same batch (`evidence/ui-publication-confirmed.json`). An initial log-only recovery read the creation event's initial owner; that incomplete interpretation is retained in `evidence/ui-publication-recovery.json`. The subsequent transfer event establishes sealing.

The reproduced UI issue was a long locked confirmation state with neither record nor transaction link. The fix exposes both links immediately after confirmation, bounds readback attempts and explicitly says not to publish again if visibility is delayed. The optional `E2E_PUBLISH=1` test records transaction evidence before its independent read and reports unavailable readback as blocked, so reruns need not lose the hash. Never automatically rerun this test after a confirmed write.

### Hosted reader and dashboard follow-up

Reviewing the rendered reader exposed a separate failure: its inputs remained uninitialised on the hosted page, although the disk-based test passed. The browser console reproduced an inline-script CSP rejection. Vercel's `cleanUrls` redirected `/reader.html` to `/reader`, and the policy exception matched only `/reader.html`. `4fcb9a9` applies the reader's self-contained policy to the clean URL as well. The deployed regression test passed on **desktop and phone** (two checks); `evidence/hosted-reader-dashboard.json` records the initialised endpoint, no console errors and zero overflow at 320 px. The disk-only test never proved the hosted version was functional; these checks now cover both paths.

The dashboard's scope now explicitly separates fictional source replies from summaries calculated from live chain reads. Its heading follows the requested introduction, status colours use the supplied palette, and final 320 px browser evidence is in the same report and `evidence/dashboard-final-320.png`.

An additional 180-check audit explicitly removed page-level overflow clipping before measuring all main routes across nine widths and both themes: **zero failures** (`evidence/unclipped-layout.json`). The remaining global `body { overflow-x: hidden }` was then removed from the source. Responsive containment is therefore supported by content bounds, not by clipping the page.

### After the query quota reset

The endpoint's Retry-After was honoured. The already-published record was then read directly with the expected title, synthetic marker, stranger creator, sealed owner and flags (`evidence/ui-publication-readback.json`); no second publication was sent. The readback-only browser test passed on desktop and phone (`evidence/remaining-readbacks.json`).

The phone live-data suite then passed **10 checks**, with only the optional signed-renewal test skipped (`evidence/phone-live-rerun.json`). This includes all previously blocked serial live paths plus two additional signing guards: switching from another network to Tiramisu, and stopping a quote older than five minutes before requesting a signature. Both assert that no transaction was sent. The age test advances browser wall time while retaining real chain responses; it is a UI guard test, not a claim of an elapsed on-chain interval. The phone missing-record rerun also passed (`evidence/missing-record-rerun.json`). The original quota failures remain preserved as earlier observations rather than being relabelled passes.
