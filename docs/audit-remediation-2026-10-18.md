# Audit remediation — 18 October 2026

Baseline: `594bd6bc3b119a1324155ace3e8cf5497e40b614`. This record covers source corrections, controlled regression tests and fresh read-only evidence. It does not claim an exhaustive external audit, real third-party wallet certification or completed hackathon submission.

| Finding | Change and evidence | Remaining limit |
|---|---|---|
| SEC-001 | Store and remove the exact provider callbacks on replacement, forget and unmount; connection generations reject stale events, restore/connect responses and signing requests. Mock-provider switch/forget tests pass. | Real extension/hardware-wallet matrix remains untested. |
| UI-001 | Freeze collection renewal keys when review opens, retain quote/results through membership and live-data refresh, and recover pending work by stable collection ID after reload. Test includes two replies and a linked appeal. | Tab storage must be available for reload recovery; collections are still local-only. |
| CHAIN-001 | A known hash becomes confirmation-unknown after polling failure, blocks another signature, and offers receipt recheck without signing. Confirmed reverts are distinct from missing receipts. Persist public transaction/review state in tab storage. | Controlled hashes are simulated; these fixes did not create a new signed campaign. |
| UI-002 | Quote the exact salted publication batch, including ownership changes, before signing. Retain that snapshot; invalidate edits, account/network changes, nonce changes and quotes older than five minutes. SDK calldata equivalence is tested. | Estimates are not final fees. |
| ARCH-001 | Request generations prevent older record/linked reads and refresh errors from overwriting a newer route. Collection discovery and reloads also reject stale responses. | No exhaustive adversarial scheduler or long-running soak test. |
| ARCH-002 | Insights checks chain identity before scanning. Reader checks it before queries, binds exports to the verified endpoint snapshot, and invalidates stale results after endpoint changes. | A provider that lies about its identity is outside this check; no second independent provider established. |
| UI-003 | Strict UTC date validation; inclusive upper bound is the final millisecond of the chosen date. Impossible/reversed dates are rejected. Package tests cover leap dates and boundaries; archive/reader browser assertions inspect actual query predicates. | Block-based expiry estimates remain approximate and separate from filing dates. |
| README-001 | Apply the reviewed README structure with the existing brand image, Mermaid architecture, actual historical campaign screenshots, fenced tree and concise evidence/limitation links. | Historical screenshots do not certify every current state; no fabricated screenshots added. |
| PERF-001 | Cache registry holds weak references rather than retaining obsolete transport maps. Each cache is limited to 256 entries; stale completions cannot erase newer entries. Tests cover eviction, clearing, deadlines and cancellation. | No measured heap profile or long-running memory claim. |
| DOC-001 | Add [contribution guidance](../CONTRIBUTING.md) and [security reporting policy](../SECURITY.md), with an honest fallback if GitHub private reporting is unavailable. | No invented private contact, enabled-feature claim, bounty or response-time promise. |
| TEST-001 | Add [read-only CI](../.github/workflows/checks.yml): package/component tests, types, both builds and local fixture browser tests. No secrets or chain-write jobs. | Hosted run status must be checked for the pushed revision. |
| COPY-001 | Distinguish local dashboard settings errors from network read failures; remove doubled punctuation. Correct publication identifier grammar and unknown-confirmation wording. | Detailed provider errors remain bounded diagnostic text. |
| TEST-002 | Add reproducible offline browser coverage across five widths, plus fresh public demo and complete raw-event readback checks below. | Screen-reader sessions, full real-wallet/network matrix, another provider, independent usability and performance field measurements remain unverified. |
| HACK-001 | Keep submission status explicitly unverified. Public links, source and video checks cannot prove a saved or submitted Devfolio entry. | Owner must verify authenticated entry, roster/eligibility, required declarations, tracks and actual confirmation. No submission was performed. |

Additional corrections found during regression work: handle the SDK's receipt-not-found exception as unknown; consume a fetch rejection when cancellation occurs before its wrapper attaches; keep publication preview usable after clearing its filing date; allow discovery of a wallet announced after the initial discovery timeout; align the exported package version with its existing 0.1.1 manifest.

## Validation and failed runs

Package suite: **62 tests in nine files passed**. Separate web/component suite: **23 tests in four files passed**. Workspace typecheck and both production builds passed. Builds are local validation of the modified working tree; their baseline SHA metadata is not proof that the baseline already contains these fixes.

The final stable-source browser matrix passed **55/55 checks**; [exact results](../evidence/audit-remediation-2026-10-18/browser-results.json), [package results](../evidence/audit-remediation-2026-10-18/package-tests.json) and [component results](../evidence/audit-remediation-2026-10-18/component-tests.json) are retained. The [configuration](../playwright.audit.config.ts) starts local web and Insights servers at 320, 390, 768, 1024 and 1440 CSS pixels. Synthetic providers have no keys; all HTTPS RPC and WebSocket traffic is intercepted. Returning a fake hash exercises post-submission failure without broadcasting. Accessibility assertions cover serious/critical WCAG 2/2.1 A/AA axe findings on six routes, plus horizontal overflow; this is not full accessibility certification or a screen-reader review.

Preserved earlier results:

- [Initial browser run](../evidence/audit-remediation-2026-10-18/initial-browser-results.json): 22 passed, two failed. Missing SDK receipts threw an exception instead of returning `null`; the expected pending copy was absent. The read-only recovery wrapper now handles that exception. Cancellation warnings observed during navigation led to the additional fetch-rejection fix.
- An intermediate 30-case rerun passed before expanding the linked-entity matrix.
- [Expanded fixture-development run](../evidence/audit-remediation-2026-10-18/expanded-fixture-failures.json): 45 passed, ten failed. The mock initially recognized an appeal-kind query, while the application uses a combined linked-entity query; the expected third entity was absent. The fixture was corrected. Source edits during that run also produced development-server hot-reload errors; the run is not treated as final validation. The corrected focused collection and multi-record recovery cases subsequently passed, followed by a fresh stable-source matrix.

Historical production failures, quota errors, skipped cases, screenshots and transaction records were not overwritten. Current controlled tests do not retroactively turn those observations into passes.

## Fresh read-only public evidence

The [raw chain readback](../evidence/audit-remediation-2026-10-18/chain-readback.json) passes for all four existing signed transactions, five matching renewal receipts, five exact extension events and both reply expiry readbacks. [The checker](../scripts/audit-readback.mjs) uses raw JSON-RPC plus the SDK event ABI, without the application's reconciliation code, wallet keys or send methods. It verifies exact historical event targets and permits a later readback expiry to be higher. The provider is the same public Tiramisu provider; this is not second-provider or external-auditor independence.

Reproduce without overwriting a prior report:

```sh
node scripts/audit-readback.mjs new-chain-readback.json
```

The [public demo check](../evidence/audit-remediation-2026-10-18/demo-check.json) records the release URL, SHA-256, byte length, **103.503-second** duration and **1280×720** dimensions. Chromium decoded frames during muted playback and after a near-end seek. No fresh human narration/content or assistive-technology review is claimed.

The previously empty GitHub About section now has a concise description, live homepage and relevant topics; [public metadata](../evidence/audit-remediation-2026-10-18/repository-metadata.json) records the result. Required AI-use disclosure and licence notices remain intact. The canonical rules were read again: submission closes at **18 October 2026, 22:59 UTC / 23:59 Africa/Lagos**, with deployments required through 23 October. Submission and eligibility remain personal/account gates, not outcomes inferred from source tests.
