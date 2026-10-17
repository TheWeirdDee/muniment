# Renewal audit corrections — 17 October 2026

Baseline: `ce957f62e299aafaae6781de265721b26db04dee`. This is the coding-agent implementation and validation record, not an independent end-to-end sign-off.

## Reported fixes from the other environment

The reported branch `fix/complete-renewal-verification` is absent from this checkout and remote branch lookup. Its reported tip `88155b0` is not a local Git object. Those commits could not be reviewed or integrated here. No branch, commit or history was deleted or rewritten. This implementation is isolated on `fix/audit-17-renewal-reconciliation`; any recovered original branch/patch must be reviewed against the baseline and these changes before integration.

## Changes

- **A01:** Receipt keys are matched by their decoded reply attributes, not return order. Each expected receipt must match its key, reply, renewing wallet, target and entity count. Each verification must name the confirmed submitted transaction and wallet. Its extension events must exactly match the entire reviewed batch, with no missing, additional or duplicate entities and the exact target for each. Every included reply/appeal/exemption expiry is then read and must reach at least that target. A later renewal can legitimately make current expiry higher; the confirmed transaction's events must still show the reviewed target exactly.
- A batch is labelled verified only when every reply passes. Unknown or lagging reads remain pending; mismatches remain unverified. The dialog shows each reply's receipt and result. It never turns a read timeout into visibility success. A recheck reads the existing transaction without signing again. Confirmed results remain separate from transaction failures, and incomplete reconciliation receives a warning rather than a success heading.
- **A02:** The retained quote itemizes every included entity by transaction and parent reply, with full key, kind, current expiry block, target block and copy control. Reply keys link to their record. Quote changes are blocked after work starts; remaining signatures require the original reviewing wallet. Explicit refresh is needed for a stale plan.
- **A03:** Homepage copy scopes renewal writes to the three-step browsing workflow and explicitly states that Publish requires a transaction too.
- **A04:** The current package inventory says 51 tests/eight files; historical counts retain their dated context. Web reconciliation/component tests are inventoried separately.

## Coding-agent validation

- Package: 51 tests/eight files pass.
- Web regression suite: 18 tests/three files pass, including the existing provenance test, multi-reply reconciliation and itemized plan rendering. Cases cover reordered/delayed/duplicated/missing receipts; incorrect reply, target, wallet, transaction or count; missing/additional/duplicated/wrong-target extension events; a delayed non-first linked entity; read failure/recheck; null expiry and an empty batch.
- Real read-only local browser review: desktop and phone pass (`tests/e2e/renew-review.spec.ts`; results in `evidence/renew-review-local-2026-10-17.json`). The quote includes multiple entities and the test checks every included key/current expiry/target and copy control, no horizontal overflow, Escape and focus restoration.
- Workspace typecheck and both production builds passed. Local browser runs do not establish deployment state or signed transaction success. The local build embeds the baseline commit with a dirty-tree flag until the correction commits exist; it is not release-version proof.
- No new blockchain transactions have been made for this correction. No new deployment has been made. Both production sites were independently checked at the baseline before coding; deployment and post-deployment results must be recorded separately.

## Independent verification after authorized deployment

1. Verify the archive and dashboard `/version.json` match the integrated correction commit. Confirm itemized plan details on desktop and phone.
2. Publish a new clearly synthetic record with 7-day storage from an authorized publisher. Retain the transaction hash, entity key, creator, creation block/time, flags and actual initial expiry.
3. Renew to 30-day coverage with an authorized different wallet. Include **multiple replies in the same transaction**, and include linked entities when applicable. A single reply plus multiple linked entities does not prove multi-reply receipt coverage.
4. Capture the exact reviewed plan before signing: each transaction, reply, included entity key/kind/current expiry/target and expected receipt count. Retain the submitted transaction hash and actual created receipt keys.
5. Independently decode the successful receipt and all creation/extension logs. Match every planned reply to exactly one receipt in that same transaction and renewing wallet. Match every planned entity to its exact target extension event. Read every entity's resulting expiry; distinguish any later extension from the audited transaction's target. Reject any missing, extra or mismatched result. Verify the app's per-reply and batch labels agree with these independent reads.
6. Test lagging/unavailable verification reads without resubmitting the confirmed transaction. Confirm the UI remains pending and can recheck the existing result. Rejection and network-switching checks must send no transaction before authorization.
7. Record public transaction links, entity links, before/after block values, every receipt result, deployed commit and final coverage. Keep the project **not fully end-to-end verified** until this independent campaign completes.

If the independent Work browser lacks a wallet, the owner can approve the exact reviewed transactions in a configured browser and provide public hashes for reconciliation. Local keys are usable on this PC, but that does not establish wallet access in Work. No private key should be copied into chat or an audit report. Submission remains separate and requires explicit authorization.
