# Fresh signed transaction campaign — 17 October 2026

**PASS for all requested real signed workflows:** fresh synthetic publication, a fresh single-reply renewal, and two atomic two-reply renewals have successful receipts, complete independent RPC reconciliation, archive/reader readbacks and explorer Success pages. The final repeat additionally verifies that completed results survive preserve-queue refresh. The later network-switch readiness and stale-quote boundary checks are **BLOCKED by public RPC read quota**, as detailed below. Independent ChatGPT Work review and real wallet-extension compatibility remain separate.

## Deployment and signing method

The reviewed A01–A04 branch was fast-forwarded into main and pushed without history rewriting. Both existing Vercel projects reported `f1e69505409dcaf383928d9a114c9b458d00a3d8` before initial signing. Source review then found that queue refresh could change the selection passed to an open results dialog. The queue now freezes that selection. Both projects reported `2a2df7241f8dd1c1cdea9b3764c4987bee42a4ca` before the final repeat; its dialog retained both reviewed replies after the renewed rows disappeared from the 120-day queue.

Every action was initiated by clicking the **actual deployed website's** publish/sign controls in Chromium. The existing EIP-1193/EIP-6963 test provider passed the browser's transaction request to its locally configured test account. An explicit automated test-wallet approval gate checked Tiramisu chain **7738577**, the Arkiv contract, zero native value, permitted operation types, and the exact reviewed extension keys/targets and receipt count. Each estimated transaction fee had to be below **0.01 test GLM**. This was an authorized isolated test wallet, not a human wallet-extension session. No direct mutation script replaced the deployed UI and no interactive extension approval was bypassed. Keys stayed in the Node signer and were never put in the page, report or repository.

Signing wallets: publication/control `0x5F2b31286708083Aa5D097bD89d5b3F48DD6cBC9`; renewer `0xe0e47735c1add1390E03766D7Bd06eC913485DE7`. Both are existing project test accounts. Only synthetic records and test GLM were used.

## Fresh transaction ledger

| Action | Result | Tiramisu explorer | Block | Signing wallet |
|---|---|---|---:|---|
| Fresh publication | **PASS** | [0xdd15a633aa62d588392cb1e5e9585ae13ab8a0679a9d3523d0d02b506aff8418](https://tiramisu.explorer.arkiv.network/tx/0xdd15a633aa62d588392cb1e5e9585ae13ab8a0679a9d3523d0d02b506aff8418) | 704329 | 0x5F2b31286708083Aa5D097bD89d5b3F48DD6cBC9 |
| Single-reply renewal | **PASS** | [0xfe501a8a39ee5ee12467e40ddf4836882a43f44df779ad3b86e9adacec6c2ace](https://tiramisu.explorer.arkiv.network/tx/0xfe501a8a39ee5ee12467e40ddf4836882a43f44df779ad3b86e9adacec6c2ace) | 704405 | 0xe0e47735c1add1390E03766D7Bd06eC913485DE7 |
| Initial two-reply renewal | **PASS** | [0x71af298abe614e5b338ba5c7d479ce66025d650716155f96e148fbed8fb3840f](https://tiramisu.explorer.arkiv.network/tx/0x71af298abe614e5b338ba5c7d479ce66025d650716155f96e148fbed8fb3840f) | 712391 | 0xe0e47735c1add1390E03766D7Bd06eC913485DE7 |
| Post-fix two-reply renewal | **PASS** | [0x16e1a14ea04d2cadc0ece0a46bdaeac8c97509e9f8824c892b5fd327479cf3af](https://tiramisu.explorer.arkiv.network/tx/0x16e1a14ea04d2cadc0ece0a46bdaeac8c97509e9f8824c892b5fd327479cf3af) | 712569 | 0xe0e47735c1add1390E03766D7Bd06eC913485DE7 |

All four explorer pages displayed **Success**, the expected full hash and HTTP 200; all four independent RPC receipts reported success. The three renewing transactions have consecutive nonces **16, 17, 18** and zero native value, corroborating that the failed pre-broadcast attempt did not add an unrecorded renewal. Exact timestamps, gas use, actual fees, approved plans and approval checkpoints are in [campaign.json](../evidence/transactions-2026-10-17/campaign.json). The last evidence-only publication commit can be newer than the runtime revisions above; application source changes are explicitly separated from report/test-tool changes.

## Fresh publication

- UI origin: https://muniment-archive.vercel.app/publish; confirmed 2026-10-17T17:33:44.000Z.
- [Published record](https://muniment-archive.vercel.app/records/0x52fdb9e23f730a9cff22632ddcc223d6a9f26ac29712e13b16f76c4e1d5ef1b8): `0x52fdb9e23f730a9cff22632ddcc223d6a9f26ac29712e13b16f76c4e1d5ef1b8`.
- Title: **Road resurfacing — Signed campaign amber (synthetic, user-published)**. Creator: `0x5F2b31286708083Aa5D097bD89d5b3F48DD6cBC9`; sealed owner: `0x000000000000000000000000000000000000dEaD`.
- Creation block: **704329**. Initial expiry: **1006729**, exactly 302,400 blocks (seven nominal days) after creation. Read-only and permissionless-extension flags are both true.
- Independent SDK/RPC readback passed schema, content, creator, owner and flags. Actual fee: **0.000178424000356848 test GLM**.
- Main archive: PASS with the explicit **any-wallet** option. The default trusted-publisher archive intentionally excludes the stranger/control wallet; its record is visibly labelled untrusted. This preserves the 41-reply trusted seed corpus.
- Standalone reader: PASS from disk with the main website blocked. It fetched the entity and actual RPC expiry without the Muniment origin.

## Per-entity and per-receipt reconciliation

### Single renewal

UI origin: https://muniment-archive.vercel.app/records/0x52fdb9e23f730a9cff22632ddcc223d6a9f26ac29712e13b16f76c4e1d5ef1b8. Runtime revision: `f1e69505409dcaf383928d9a114c9b458d00a3d8`. Confirmed at 2026-10-17T17:36:16.000Z; receipt status `success`. Actual transaction fee: 0.000117432000234864 test GLM.

| Entity key | Kind | Expiry before | Transaction target/event expiry | Fresh RPC expiry | Result |
|---|---|---:|---:|---:|---|
| 0x52fdb9e23f730a9cff22632ddcc223d6a9f26ac29712e13b16f76c4e1d5ef1b8 | reply | 1006729 | 2000356 | 2000356 | PASS |

| Created receipt | Named reply | Receipt target | Entity count | Result |
|---|---|---:|---:|---|
| 0x2b3bb36d7f45a1d15073143a1589a2df6739c4ae2f62b872ae7f30adcdaabec7 | 0x52fdb9e23f730a9cff22632ddcc223d6a9f26ac29712e13b16f76c4e1d5ef1b8 | 2000356 | 1 | PASS |

Every receipt was fetched separately, decoded, matched to exactly one reviewed reply, and checked against its immutable creator and the confirmed creation block. Every expected extension event was matched individually at the exact reviewed target; no missing/additional/duplicate events were accepted. Fresh entity reads reached that target. The check uses separate Node RPC requests and raw event decoding rather than calling the app's reconciliation function. The deployed dialog also reported verified.


### Initial two-reply renewal

UI origin: https://muniment-archive.vercel.app/preserve. Runtime revision: `f1e69505409dcaf383928d9a114c9b458d00a3d8`. Confirmed at 2026-10-17T22:02:28.000Z; receipt status `success`. Actual transaction fee: 0.000234864000469728 test GLM.

| Entity key | Kind | Expiry before | Transaction target/event expiry | Fresh RPC expiry | Result |
|---|---|---:|---:|---:|---|
| 0x52fdb9e23f730a9cff22632ddcc223d6a9f26ac29712e13b16f76c4e1d5ef1b8 | reply | 2000356 | 4600383 | 4600383 | PASS |
| 0x644d5e2448b4d4e4baab746db634685ac6d7a0e99a0c6bb09d5558c6f0600972 | reply | 1533883 | 4600383 | 4600383 | PASS |

| Created receipt | Named reply | Receipt target | Entity count | Result |
|---|---|---:|---:|---|
| 0x93326256f00753cc219e5183bfaa5aedc730367dfebd5427d6e01057c45d5caf | 0x52fdb9e23f730a9cff22632ddcc223d6a9f26ac29712e13b16f76c4e1d5ef1b8 | 4600383 | 1 | PASS |
| 0x6ed825d83d8529b3d5aebccf0251ba60f037565a18a5ba2fad324afb8966c751 | 0x644d5e2448b4d4e4baab746db634685ac6d7a0e99a0c6bb09d5558c6f0600972 | 4600383 | 1 | PASS |

Every receipt was fetched separately, decoded, matched to exactly one reviewed reply, and checked against its immutable creator and the confirmed creation block. Every expected extension event was matched individually at the exact reviewed target; no missing/additional/duplicate events were accepted. Fresh entity reads reached that target. The check uses separate Node RPC requests and raw event decoding rather than calling the app's reconciliation function. The deployed dialog also reported verified.


### Post-fix two-reply renewal

UI origin: https://muniment-archive.vercel.app/preserve?within=120. Runtime revision: `2a2df7241f8dd1c1cdea9b3764c4987bee42a4ca`. Confirmed at 2026-10-17T22:08:24.000Z; receipt status `success`. Actual transaction fee: 0.000234864000469728 test GLM.

| Entity key | Kind | Expiry before | Transaction target/event expiry | Fresh RPC expiry | Result |
|---|---|---:|---:|---:|---|
| 0x52fdb9e23f730a9cff22632ddcc223d6a9f26ac29712e13b16f76c4e1d5ef1b8 | reply | 4600383 | 8488564 | 8488564 | PASS |
| 0x644d5e2448b4d4e4baab746db634685ac6d7a0e99a0c6bb09d5558c6f0600972 | reply | 4600383 | 8488564 | 8488564 | PASS |

| Created receipt | Named reply | Receipt target | Entity count | Result |
|---|---|---:|---:|---|
| 0xd1c43f857ec733d19d61b0f382db003f71ef6896aecbae692bed31e50b7a9665 | 0x52fdb9e23f730a9cff22632ddcc223d6a9f26ac29712e13b16f76c4e1d5ef1b8 | 8488564 | 1 | PASS |
| 0x557d87bd0c00401d8669676cecae8d1161dfb5f9244ebd8feeca2e212cc81668 | 0x644d5e2448b4d4e4baab746db634685ac6d7a0e99a0c6bb09d5558c6f0600972 | 8488564 | 1 | PASS |

Every receipt was fetched separately, decoded, matched to exactly one reviewed reply, and checked against its immutable creator and the confirmed creation block. Every expected extension event was matched individually at the exact reviewed target; no missing/additional/duplicate events were accepted. Fresh entity reads reached that target. The check uses separate Node RPC requests and raw event decoding rather than calling the app's reconciliation function. The deployed dialog also reported verified.


## Archive, reader and refresh checks

Both replies appeared in the deployed preserve queue and itemized review before signing. Independent reader pages fetched both renewed replies from disk while the Muniment site was blocked, and displayed the actual fresh RPC expiry. The final archive run checked both full entity keys and expiry tooltips against live RPC values. Final expiry for both is **8488564**. This is later than the single-renewal target because the same record was subsequently renewed twice; the earlier transaction's exact target remains recorded in its events and earlier readback.

The final repeat waited for the renewed rows to disappear from the 120-day queue, then asserted that the open modal still showed **Verified renewal**, both original included entities and the complete results. Flags: queue rows removed = `true`; results retained = `true`. Screenshot: [queue refresh retained](../evidence/transactions-2026-10-17/multi-queue-refresh-retained.png).

## Failure and simulated-boundary evidence

The first multi-reply attempt showed an **actual pre-broadcast RPC execution error** and produced no submitted hash. Its failed test and screenshot are retained in [first-failed-attempt.json](../evidence/transactions-2026-10-17/first-failed-attempt.json) and [screenshot](../evidence/transactions-2026-10-17/multi-attempt-1-failed.png). The underlying RPC supplied no useful revert data, so its exact backend cause remains unknown. A fresh quote/retry on the same application revision succeeded; the two earlier successful transactions were reused from checkpoints rather than sent again. This failure is not relabelled as a pass.

The initial explorer automation also used a word-boundary regex that failed on concatenated DOM text containing “Success”. The selector was corrected to the actual Success element and all four explorer pages passed; that selector failure was a test-harness issue.

The separate boundary run had **2 passes, 1 environmental failure and 1 skipped case**. Landing and simulated wallet rejection passed; rejection explicitly asserted zero transactions sent. The simulated wrong-network test switched to Tiramisu, then failed its readiness assertion because discovery reported a public-endpoint read throttle of about **3,079 seconds**. The UI explicitly showed that error and kept the Sign button disabled. It was not a signed transaction failure. The serial stale-quote case was skipped after that environmental failure. These two readiness cases are **BLOCKED for this fresh run**, not passes; earlier passing results remain historical. The public quota was not deliberately exhausted or bypassed, and no aggressive retry was attempted. These simulated error-state checks are separate from the four completed real transactions. Results: [simulated-boundaries.json](../evidence/transactions-2026-10-17/simulated-boundaries.json), [quota state](../evidence/transactions-2026-10-17/quota-blocked-network-switch.md), [screenshot](../evidence/transactions-2026-10-17/quota-blocked-network-switch.png).

## Reproduction and limits

The opt-in runner is `scripts/transaction-campaign.mjs`; run via `node --env-file=.env --import tsx` only with explicit authorization, `E2E_REAL_CAMPAIGN=1` and `MUNIMENT_EXPECTED_COMMIT` set to the deployed revision. It checkpoints submitted hashes in ignored `.release/transaction-campaign.json` before readbacks and never intentionally re-signs a checkpointed transaction. Preserve that file after an interrupted run. `E2E_RETENTION_REPEAT=1` authorizes one additional retained-results repeat after an initial successful campaign; it does not repeatedly reset a completed repeat. The read-only companion is `scripts/campaign-final-readback.mjs`.

The campaign covers one reply plus one seeded reply, five renewal receipts across three renewal transactions, and every extension in those transactions. It does not constitute a fresh signed appeal/exemption-extension campaign, a second independent RPC-provider test, or certification of third-party wallet extensions. Unit tests cover linked-entity mismatch and delayed-read cases. ChatGPT Work can independently audit these public hashes and records; no repository mutation by Work or Devfolio submission is authorized by this report.
