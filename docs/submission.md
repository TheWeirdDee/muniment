# Submission: Arkiv Global Tour Stop (Devfolio)

Tracks: **Censorship Resistance** and **Open Source**. No team member holds Indian nationality, so Best Indian Use Case is not entered.

Canonical rules checked: `Arkiv-Network/global-tour-stop-pre-devcon` README, RULES.md, docs/scoring-rubric.md and docs/submission-checklist.md (frozen since 9 Oct 2026). Deadline: **18 October 2026, 22:59 UTC**. The repository commit at the deadline is the judged version. Deployments stay up through 23 October.

## Standard fields

- **Project name:** Muniment
- **Tagline:** Public answers. Worth keeping. A censorship-resistant archive of government replies on Arkiv.
- **Links:** repository https://github.com/TheWeirdDee/muniment · live app https://muniment-archive.vercel.app · demo video (1:44): https://github.com/TheWeirdDee/muniment/releases/download/demo-2026-10-16/muniment-demo.mp4
- **The problem it solves\*:**
  > Replies to information requests often exist in one place: a government portal, or one person's inbox. In August 2023, The Wire and National Herald (citing The Hindu) reported that records of past applications disappeared from India's RTIOnline portal, with a maintenance notice saying archival data would "be available soon". Journalists and civic researchers who need to cite a reply months later depend on that single custodian. Muniment keeps replies as Arkiv entities that are searchable by authority, outcome, exemption and response time; that nobody can edit; that most of the time nobody can delete; that any wallet can renew; and that anyone can read with a standalone HTML file instead of our website. This edition uses synthetic records only.
- **Challenges I ran into\*:**
  > The public RPC has a windowed per-IP query budget that our seeding and screenshots exhausted, which made a proof run hang silently while receipt polls were rate limited. We built a rate-limit-aware transport that honours Retry-After, and cut linked-record reads from five queries to one. Read-only alone doesn't stop the owner deleting an entity, so we seal records by moving ownership to a burn address in the creating batch. ExpiryExtended events name the owner rather than the payer, so renewal attribution verifies the creating transaction of each receipt instead.

## Organiser questions

1. **Live app URL\*:** https://muniment-archive.vercel.app
2. **Does any team member hold Indian nationality?\*:** No.
3. **Why Arkiv?\***
   > The product promise is that a stranger can keep a record available without being able to change it, and that someone outside our team can read it without our backend. On Postgres or our own API, the operator decides what stays published and who can read it; replication needs more governance. IPFS can keep bytes pinned, but a CID isn't a searchable archive, and it has no renewal accounting. A custom contract plus an indexer could enforce similar rules, at the cost of the contract and indexer we'd then have to run. Arkiv gives us typed queryable attributes, per-entity expiry, read-only and permissionless-extension flags, an immutable creator, ownership transfer and atomic batches, all in one public database. We deliberately keep off Arkiv: keys, personal data, browser collections and private notes, saved searches, full-text indexes and the synthetic source fixtures.
4. **How do you use Arkiv?\*** (with code links)
   > - **Attributes vs payload:** every filter is a typed attribute: `filed_ms`/`replied_ms` u64, `response_days` i32 (absent for unanswered requests), `outcome`/`authority`/`topic` str, `reply`/`corrects` key. Text lives in the JSON payload. [schema.ts](https://github.com/TheWeirdDee/muniment/blob/main/packages/muniment-query/src/schema.ts)
   > - **Queries:** compound predicates, numeric ranges, `$expiresAt` ranges for the preserve queue, `$creator` allowlists, `$key` lookups, one `reply = key(K)` query for all linked records, and cursor pagination. [queries.ts](https://github.com/TheWeirdDee/muniment/blob/main/packages/muniment-query/src/queries.ts)
   > - **Creation flags:** replies, appeals and exemption relations are `readonly` + `permissionlessExtension`, so strangers renew but nobody edits. [seed.ts](https://github.com/TheWeirdDee/muniment/blob/main/scripts/seed.ts)
   > - **Ownership transfer:** sealing transfers ownership to `0x…dEaD` in the creating batch, because read-only doesn't stop owner deletion (proofs P3d and P3f).
   > - **Expiration:** lifetimes per kind (replies 21–180 days, relations on the reply's block, receipts exactly until their target, reviews 365 days).
   > - **Lifetime extension:** renewals with absolute `atBlock` targets for a reply and its linked records. [renew.ts](https://github.com/TheWeirdDee/muniment/blob/main/apps/web/src/lib/renew.ts)
   > - **Atomic batches:** publish = reply + relations + appeals + seal; renew = extensions + receipt; a deliberately failing batch leaves nothing (P4a).
   > - **`$creator`:** the trust filter, provenance display, and renewal verification against `tx.from`. [verify.ts](https://github.com/TheWeirdDee/muniment/blob/main/packages/muniment-query/src/verify.ts)
   > - **WebSocket events:** record pages refresh on `watchEntityEvents` over `webSocket()`, with no `fromBlock`. [live.ts](https://github.com/TheWeirdDee/muniment/blob/main/apps/web/src/lib/live.ts)
5. **Friction report:** https://github.com/TheWeirdDee/muniment/blob/main/arkiv/friction.md
6. **Wallet addresses that create Arkiv entities\*:**
   > - `0x817574740F413816636FAE23064607084e2C0604`: publisher (all 41 synthetic replies, 19 exemption relations, 9 appeals; proof controls). Team test wallet.
   > - `0xeC5C622d43217c5DA7C006be11909c0Fb6fFf5C1`: reviewer (11 reviews). Team test wallet.
   > - `0xe0e47735c1add1390E03766D7Bd06eC913485DE7`: renewer (renewal receipts, extensions). Team test wallet.
   > - `0x5F2b31286708083Aa5D097bD89d5b3F48DD6cBC9`: stranger (permission tests, a deliberately forged receipt). Team test wallet.
   > Visitors who publish from the app create entities from their own wallets.
7. **Link to schema.md\*:** https://github.com/TheWeirdDee/muniment/blob/main/arkiv/schema.md
8. **How can judges reproduce your Arkiv usage?\***
   > 1. Open https://muniment-archive.vercel.app/archive?outcome=denied. Seven synthetic refused replies load straight from Arkiv (the exact query is under "The exact Arkiv query behind these results").
   > 2. Run the same query with curl (copy it from arkiv/schema.md, "Reproduce with curl"). The same keys come back, created by `0x8175…0604`.
   > 3. Open any record: claimed issuer vs on-chain publisher, sealed owner `0x…dEaD`, reviews, and the creation transaction in the explorer.
   > 4. Renew storage from any funded Tiramisu wallet (Record → Renew storage). The dialog shows the plan, the gas estimate and the target block, then submission, confirmation, the new expiry read back and receipt verification.
   > 5. Download reader.html, open it from disk and read the same record key with no Muniment site involved.
   > 6. Open https://muniment-insights.vercel.app, a separate app reading the same contract.
   > If a page says the public endpoint is rate limiting your connection, that is Arkiv's per-IP query budget; wait the stated time or set another endpoint in Settings.
   > 7. Optional: clone the repo, add four testnet keys to `.env` and run `npm run proof`. It writes pass/fail evidence for flags, permissions, sealing, atomicity, forged receipts and expiry.
9. **Pre-existing work you reused\*:**
   > Repository baseline `f2202e95ca2e68cbbbfaf4c96f260b97d6091540` (15 Oct 2026, an initial commit containing only a README). Everything else was built during the hackathon. We reused open-source libraries only (listed in THIRD_PARTY_NOTICES.md: Arkiv SDK, viem, React, React Router, Vite, Fontsource fonts, Playwright, Vitest). No starter template.
10. **Arkiv surfaces used\*:** TypeScript SDK; Direct JSON-RPC (standalone reader, gas estimates, log lookups); WebSocket events; Docs; Hub; Faucet; Block Explorer.
11. Other: —
12. **Time to first Arkiv entity\*:** *(team to confirm. Our first write was the seed on 15 Oct, after the wallets were funded the same day.)*
13. **LLMs used\*:** *(team to answer truthfully)*
14. **The one thing Arkiv should improve first\*:** Document the public RPC's read budgets and populate `Arkiv-Cost` on responses. Censorship-resistant reading depends on the unauthenticated path, and being locked out of queries with no explanation is the failure real readers hit.
15. **Open to a 20-minute feedback call?\*:** *(team to answer)*
16. **Built 9–18 October; pre-existing and third-party work disclosed\*:** Yes (see 9).
17. **Public MIT repo, all links accessible\*:** Yes, after the final push; verify in a logged-out browser.
18. Devcon attendance: optional, *(team to answer)*.

## Verification status

Recorded in [`docs/testing.md`](testing.md). The final production browser run is appended below when complete.
