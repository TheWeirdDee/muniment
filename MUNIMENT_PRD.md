# Muniment PRD — Revised v2

Revision date: 15 October 2026. Status: product specification for review, not an implementation or a claim of verified protocol behaviour. Supersedes the previous PRD.

## 1. Product definition

Muniment helps journalists and civic groups preserve and search government replies, even when the original website or uploader disappears. Anyone can fund continued storage, and independent tools can read the archive.

In simple words: save a public answer, find it again, and help keep it available without depending on the person who uploaded it.

Primary track: Censorship Resistance. Secondary: Open Source. No team member holds Indian nationality; do not enter Best Indian Use Case or declare eligibility for that track.

Hackathon: Arkiv Global Tour Stop, 9–18 October 2026. Submission deadline: 18 October, 22:59 UTC / 23:59 Lagos and London. Keep the deployment available through 23 October. The deadline commit is the judged version; do not rewrite its history.

### Core promise

A publisher creates a queryable record. A different wallet can renew its storage lifetime without acquiring permission to alter its content. An independent reader retrieves the same record directly from Arkiv.

This promise is conditional on tested Arkiv permissions, continuing network operation, accessible RPC endpoints and timely renewal. Muniment does not promise permanent storage, universal reachability or government authenticity.

### Submission boundary

The deployed hackathon edition uses synthetic records only. It is a working preservation tool demonstrated with test data, not an existing civic archive or a government service. All public counters, examples and analytics identify that scope.

## 2. User and problem

Primary user: a journalist investigating public expenditure who needs to find, cite and revisit government replies over months or years.

Secondary users: civic researchers collecting related replies; organisations funding the preservation of documents they use; developers building tools on a shared archive.

Representative journey:

1. A journalist searches for replies about road spending by authority and date.
2. They inspect a record's text, provenance, publication transaction and verification status.
3. They add it and related replies to a local collection and export a citation bundle.
4. They see which records approach expiry and what renewing them would cost.
5. A different wallet renews a selected record. The journalist sees confirmed coverage change.
6. If Muniment's site is unavailable, the journalist opens the standalone reader and retrieves the same entity from Arkiv.

The actor and investigation in the demo are explicitly illustrative. Do not invent endorsements, interviews, users or adoption.

### Problem evidence

The original proposal cites reporting about records disappearing from India's RTI Online portal in August 2023. Verify the reports before using dates, counts or quotations in product copy. Distinguish removal of portal application histories from a claim that all replies were publicly searchable or deliberately censored. Do not describe every RTI reply as safe for republication.

The product addresses dependence on a single custodian. It does not establish motive for a historical removal or solve access to documents never published.

## 3. What makes it distinctive

The product moment is a stranger renewing a record while remaining unable to change it. The independent reader demonstrates that the team does not control the only reading interface. A second application demonstrates reuse of the same documented dataset.

The preservation unit is a record with an explicit expiry and a verifiable publication history. Preservation is collective funding of continued availability, not a popularity contest or proof that a claim is true.

## 4. Why Arkiv

Arkiv is the primary data layer. Structured filters use its queryable attributes; texts and supporting metadata use payloads. Permissionless lifetime extension, if verified, lets another wallet renew records. Creation flags constrain mutation. Public queries allow replaceable frontends.

| Alternative | Specific difference and honest qualification |
|---|---|
| Operator-controlled Postgres/API | A conventional single-operator deployment leaves publication, deletion and read access under that operator. Replication and federation can reduce this, but require additional governance and infrastructure. |
| IPFS | Community pinning can preserve content. Structured discovery and renewal accounting need additional components; a CID alone is not a searchable archive. |
| Custom contract plus indexer | Could implement comparable rules, with added contract and indexing work. Muniment uses Arkiv's existing data primitives instead. |
| Subgraph | Useful for indexed data, but availability depends on the chosen deployment and providers. Avoid claiming all subgraphs have one operator. |

Deliberately off Arkiv: wallet secrets, private access credentials, personal information, private collection notes, local saved searches and full-text indexes. Hackathon scan fixtures are synthetic, publicly distributable and optional. An external scan has its own availability and preservation needs; renewing its Arkiv pointer does not preserve its bytes.

## 5. Scope and completion order

The complete target includes search, record pages, synthetic publishing, preservation collections, batch renewal, independent reader, a reuse dashboard, query package, evidence and documentation.

Deliver in this order so every stage has a working end-to-end path:

1. Validate Arkiv flags and raw reads; publish one synthetic record; another wallet extends it; independent reader confirms it.
2. Build search, provenance, record pages, accessible wallet flow and reliable transaction states.
3. Add local collections, renewal quotes, export and independently verifiable renewal activity.
4. Add compatible appeals, expiry queue and reconnecting live updates.
5. Deliver the second application, query package, measured behaviour, proof campaign and submission assets.

If protocol behaviour prevents a feature, resolve the design and update the claim. Do not keep a decorative control, fake success or silently replace live queries with fixtures. Publish no unsupported claims to meet a schedule.

## 6. Authenticity and provenance

Preservation proves what was submitted, by which wallet and when. It does not prove an authority issued the document or that its contents are true.

Every record shows:

- Synthetic demo status prominently.
- Claimed issuing authority, separately labelled from the on-chain publisher.
- Creator wallet from chain metadata, entity key, creation transaction, network and schema version.
- Claimed source URL/reference and document date, with unavailable-source states.
- Source attachment availability, if supplied; an attachment is supporting material, not automatic verification.
- Verification status, reviewer wallet and review method where applicable.

Statuses: `unreviewed`, `source-compared`, `disputed`, `superseded`. A review is an append-only statement by a wallet. Display it as “source compared by [wallet]”, never universal certification. Reviewer trust is selected by readers or explicit application configuration. A self-written reviewer name confers no authority.

Reviews identify the exact entity, method, limitations, optional evidence reference and timestamp. Negative or conflicting reviews remain visible. Corrections create a new immutable record linked to the old one; the old record is not silently rewritten. Render the original and correction with clear links and attribution.

The synthetic corpus includes a disputed example and a corrected example to demonstrate these states without introducing real misinformation.

## 7. Publication and data safety

The hackathon publish surface accepts a fixed, reviewed synthetic template selection and validated synthetic structured variations. Do not expose unrestricted real-document upload or arbitrary scan URLs in the public demo. Developers can run controlled synthetic publication scripts.

A client-side scrubber is defence in depth, not a privacy guarantee. It detects common email, phone, Aadhaar-like, PAN and address patterns, but cannot detect every name or identifying context. Users cannot bypass the synthetic-only boundary by acknowledging a warning.

No real personal data, secrets or hashes of personal data go on Arkiv. No original real RTI scans are uploaded. Explain public visibility, expiry, irreversibility of disclosure and limits of deletion before signing.

A future real-document release needs a separate policy and review process for redaction, consent, sensitive context, abuse and jurisdiction-specific publication requirements. It is outside this submission's claims.

## 8. Preservation workflow

### Collections

Users save related entity keys in browser-local collections, name the collection and export/import JSON. Collections require no account. Warn that local storage can be cleared; never imply device sync or automatic backup. Notes remain local and are excluded from public transaction payloads.

Each collection shows confirmed expiry, approximate time remaining, missing/unavailable items and estimated renewal cost. Sort by urgency without implying neglected records lack value. Use the wording “No renewal observed” rather than “Nobody needs this.”

### Renew

1. Choose records and duration or target coverage.
2. Fetch fresh chain state and discover eligible linked appeals.
3. Validate permissions, current expiry, limits and batch size.
4. Show itemised estimated storage and transaction costs in actual testnet units, target expiry and assumptions. No invented fiat conversion or production price claim.
5. Simulate where supported; request wallet signature.
6. Track submitted, confirmed, awaiting query visibility and verified states separately.
7. Read resulting expiry from Arkiv. Count success only after the intended increase is verified.

Quotes can become stale; concurrent renewals require refreshed calculations. Never shorten an existing lifetime. Define whether the SDK accepts an increment or absolute target through a probe, then implement accordingly. Explain that testnet tokens have no demonstrated production funding economics.

Within a supported batch, the reply, included appeals and renewal receipt must succeed atomically. Across multiple batches, show per-batch progress and partial completion accurately. A newly added appeal may be absent from an earlier discovery snapshot; do not promise all linked records remain synchronized forever.

### Sustainability

Potential funders are newsrooms, civic organisations and researchers maintaining collections. These are hypotheses until tested. Export and visible renewal queues reduce dependence on memory. Browser-open warnings do not constitute background reminders; scheduled notifications require a separately implemented service and permission.

## 9. Arkiv schema contract

Implement `/arkiv/schema.md` as the authoritative, versioned data contract. The following is a logical schema, not a claim that a particular SDK signature or attribute type is supported. Check every field, flag, query, expiry unit and operator against the installed 0.8.x package and node first.

All entity types have a collision-resistant application namespace and schema version, plus an explicit synthetic marker. Query predicates include these fields. A namespace is discoverability, not authentication: hostile writers can copy it. Validate payloads, creator metadata and entity permissions before showing actionable controls.

| Entity | Query attributes | Payload and lifetime policy |
|---|---|---|
| reply | app, version, kind, synthetic, authority, jurisdiction, filed date, optional reply date, optional elapsed days, outcome, language | Question, answer, claimed source metadata, optional synthetic attachment reference, correction reference. Immutable content and permissionless extension only after both are verified. Default 180 days. |
| appeal | app, version, kind, synthetic, reply key, stage, filed date, outcome | Synthetic appeal text and provenance. Compatible immutable and permissionless extension permissions; initial lifetime at least the parent's current expiry where supported. |
| renewal receipt | app, version, kind, reply key, confirmed target expiry | A public claim tied to the same atomic extension transaction. Receipt authenticity is checked against chain execution, never assumed from its attributes. Immutable, with suitable expiry if supported. |
| review | app, version, kind, reply key, status | Review method, evidence reference and limits; reviewer identity comes from on-chain creator. Immutable; explicit independent expiry. |

If key-valued attributes or tagged numeric constructors are unsupported, use documented supported equivalents and update consumers together. Preserve numeric types for range predicates. Distinguish dates in milliseconds from expiry block numbers; store units explicitly in documentation and export.

Use a separate relation entity if multiple exemption sections require indexing. Do not silently discard secondary sections. `no-reply` records have no invented reply date; distinguish elapsed waiting time from completed response duration. A “more than 30 days” filter is descriptive, not a blanket legal finding: exceptions and different statutory timelines may apply.

### Required queries

- Compound filters by namespace, version, authority, jurisdiction, outcome, exemption section and filed date.
- Completed response duration range, separate from unanswered waiting time.
- Replies expiring between current block and a verified future threshold.
- Linked appeals, reviews and renewal claims for a record.
- Creator-filtered views using authentic on-chain creator metadata.
- Cursor pagination with deduplication and stable presentation rules.

Sorting a fetched page is not global sorting. Global counters, keeper rankings and analytics require a complete bounded scan or an explicit partial-results label. Full-text search covers only downloaded records unless the entire relevant set has been fetched. Expose coverage and loading state.

## 10. Verified renewal attribution

A `keep` or renewal entity alone is not proof of payment, extension or causality. A malicious writer can create a plausible claim or reference someone else's transaction.

The verified path checks successful transaction execution, target entity, relevant extension operation, old/new expiry where obtainable, receipt creation in that same transaction, and the authenticated creator/sender relationship appropriate to Arkiv's actual execution model. Define this exact algorithm after inspecting real receipts and batch semantics.

If the chain interfaces cannot establish that relationship reliably, display “renewal claim, unverified” and omit it from verified activity counts. Do not infer verification from a familiar wallet or matching timestamp.

Count distinct verified renewing wallets, not people. Team-controlled wallets are labelled test participants. Wallet count is neither community adoption nor document credibility. Earlier receipt expiry can erase historical counts, so any displayed total must state its observation window and evidence source.

## 11. Independent reader and reuse demonstration

`reader.html` is self-contained: inline code/styles, no runtime CDN, no Muniment API, no bundled private credentials. It supports endpoint configuration, structured search, pagination, record detail and JSON export. Display network identity and endpoint errors.

Verify raw RPC method syntax, CORS and file-origin behaviour rather than assuming a disk-opened HTML file works. Test both local file opening and static hosting. If file-origin access is blocked, explain the limitation and provide a reproducible static-hosting route. Do not claim endpoint independence from two URLs that use the same provider.

Prove frontend independence by blocking Muniment's origin while retaining network access to the selected RPC. This is not an offline-network mode.

Second application: a separately served response-time dashboard consuming the public data contract and `muniment-query`. Show counts, response-time distributions, denials and unanswered cases by authority with transparent denominators. All charts identify synthetic data, sample coverage and missing values. No shared private API or hidden data source. A developer can run it from documented instructions without permission from the team.

Publish the query package with supported versions, examples, error behaviour and schema compatibility. A workspace package is not described as published to npm until it actually is.

## 12. UX and frontend requirements

Hero: “Public answers shouldn't vanish.” Supporting line explains community-funded preservation. Prominent synthetic-testnet banner. Primary actions: search archive, explore preservation, open independent reader.

Record pages prioritise content and provenance, then preservation state and action. Keep blockchain details available in an expandable evidence panel. Do not hide verification limitations behind tooltips alone.

Responsive at 360, 390, 768 and 1440 px. No missing controls or horizontal page overflow. Consistent buttons across landing and application. Light, dark and system themes. Keyboard access, visible focus, labelled inputs, adequate contrast and reduced-motion support. Wallet connection survives ordinary navigation; refresh restores public browsing without requiring authentication.

Handle rejected signatures, disconnected wallets, wrong networks, insufficient funds, stale quotes, RPC rate limits, pending transactions and delayed query visibility. Avoid duplicate writes after retries. Never show an optimistic “preserved” message as confirmed success.

Live updates use tested WebSocket subscriptions and reconnect recovery. Periodic state reconciliation may supplement events and must be described accurately. Compute expiry from authoritative block state with clearly approximate wall-clock translations.

## 13. Threat model and limits

| Threat | Required handling |
|---|---|
| Fabricated authority document | Claimed issuer separated from publisher; provenance and review limitations visible. |
| Forged renewal activity | Verify execution linkage; otherwise label unverified and exclude from counts. |
| Owner deletion or mutation | Test owner and stranger separately, including ownership-transfer paths. Narrow claims if the protocol allows an escape. |
| Spam and sybil wallets | Bounded queries, payload validation, creator filters; gas and wallet counts are not sufficient anti-abuse guarantees. |
| Malicious payload/URL | Render text safely, validate schemas, constrain links and attachments, bound payload sizes. Never execute record content. |
| Lost funding or neglected records | Collection exports, urgency queue, transparent expiry. No promise of permanence. |
| RPC outage or blocked frontend | Configurable endpoints, independent reader and explicit network/provider limits. |
| Testnet reset | Seed scripts, transaction manifest and preserved evidence; reseeding is disclosed, not presented as uninterrupted persistence. |
| Missing entity | Distinguish unknown, expired when evidenced, malformed, unsupported schema and temporarily unavailable. |

An expiry tombstone requires a prior observation, manifest or retrievable historical proof. Absence from a query alone does not prove expiry. Deletion/expiry does not guarantee erasure of copies already read or historical chain material.

## 14. Measurement and proof campaign

Before polishing, run a disposable synthetic probe and record exact SDK, node, runtime and environment versions. No guessed code snippets become implementation requirements.

Required tests and evidence:

1. Publish with required flags; attempt update/delete as owner and stranger; test transfer-related permission changes where supported.
2. Extend using another wallet; prove resulting expiry via direct read. Identical no-permissionless control rejects that extension.
3. Renew a reply and eligible appeal atomically; introduce one failing operation and verify no partial writes in that batch.
4. Submit a forged renewal claim and show it excluded from verified activity.
5. Verify independent-reader searches while the main origin is blocked; test any claimed alternate providers.
6. Use a short-lived synthetic control to observe real expiry. Do not fake a countdown crossing or simulate deletion as expiry.
7. Test concurrent renewal, stale quote, rejected signature, reconnect and rate-limited reads.
8. Reproduce the dashboard from the published contract and query package.
9. Verify synthetic-only publication boundaries and accessible mobile flows.

For latency, collect at least five runs each for submission-to-receipt, receipt-to-query-visibility and receipt-to-other-client-update. Correlate events to the exact target and transaction; unrelated events do not count. Use bounded polling, deadlines and backoff. Report failures and sample sizes, not invented percentiles. Document timing assumptions in `SPONSOR_BEHAVIOUR.md`.

Seed about 40 synthetic replies spanning authorities, dates, outcomes and exemptions, with appeal, dispute and correction examples. Use clearly labelled team wallets for mechanism tests. A volume campaign of 100 renewals is optional reliability testing, not evidence of real demand.

Seek an independent usability session if possible. Record task success and observed friction honestly; do not fabricate feedback or imply a small test validates market demand.

## 15. Success criteria

- A new visitor can find a relevant synthetic reply and understand source uncertainty without connecting a wallet.
- Another wallet renews the record, and the resulting lifetime is independently verifiable.
- Verified activity cannot be inflated by a standalone forged receipt entity.
- A researcher can preserve a collection, export it and understand any partial completion.
- An independent reader queries the same live records without Muniment's origin.
- A separate dashboard consumes the documented public contract.
- All material preservation, mutation and availability claims match demonstrated behaviour.
- Required evidence, accessible deployment and reproducible instructions are complete before submission.

## 16. Friction report

Maintain `/arkiv/friction.md` during development. Each entry includes tested surface, versions, expectation, actual result, minimal reproduction and suggested improvement or working-path conclusion. Link scripts under `/arkiv/friction/`.

Treat SDK query operators, attribute naming rules, expiry event availability, event attribution, batching order, raw RPC, CORS, sorting, access keys and rate limits as hypotheses to test. Do not repeat issue titles as current defects without reproduction. Document smooth paths with the same rigour. Never manufacture a defect to fill the report.

## 17. Evidence and repository deliverables

- Public MIT repository with setup, pinned dependencies, environment template and no secrets.
- `/arkiv/schema.md`, `/arkiv/friction.md` and executable reproductions.
- `SPONSOR_BEHAVIOUR.md` with measured results and limitations.
- Network configuration for Tiramisu, chain ID 7738577; validate current endpoints before release.
- Publisher and test-renewer addresses with truthful roles.
- Entity/transaction manifest, query examples, expected results and expiry policies.
- Independent reader, query package and second application instructions.
- Threat model, synthetic-data policy and provenance/verification explanation.
- Exact baseline SHA and reused components for any pre-existing work. Do not write “None” without checking actual history and dependencies.
- Demo video no longer than three minutes; all required submission questions answered.

Keep normal demo records alive beyond judging, preferably past 1 November. Short-expiry controls are separate, labelled and backed by saved transaction evidence. Do not commit private keys, RPC secrets, sensitive recordings or access credentials.

## 18. Demo film — approximately 2:45

| Time | Visible proof |
|---|---|
| 0:00–0:20 | An illustrative journalist needs a reply after its original source is unavailable. Clearly identify the synthetic scenario. |
| 0:20–0:45 | Search, inspect text and provenance, explain “preserved” versus “authenticated”. |
| 0:45–1:15 | Add records to a collection, inspect renewal quote and renew from a different wallet. |
| 1:15–1:40 | Confirm the expiry increase on a second client and show an unauthorised mutation rejected. |
| 1:40–2:10 | Block the main site's origin; retrieve the same entity in the independent reader. |
| 2:10–2:30 | Open the separately served dashboard using the same public data contract. |
| 2:30–2:45 | Explain Arkiv's contribution, expiry/funding limits and where reproduction evidence lives. |

Use real captured transactions and readable captions. Edited waiting periods are disclosed; never animate an unobserved result into a claimed live success. The factual problem statement needs verified sources before narration.

## 19. Delivery schedule

15 October: verify protocol permissions, attribution feasibility and reader access; finish the core live journey.

16 October: search, provenance, local collections, quotes, appeals and resilient updates; start measured evidence and independent usability work.

17 October: dashboard/package, complete proof campaign, documentation and first valid submission with a complete video. Reserve time for defects.

18 October: final mobile/accessibility and external-user checks, reconcile all claims against evidence, deploy the exact submitted source and freeze assets ahead of the 22:59 UTC deadline. Verify the submitted links in a clean session.

The final report distinguishes implemented, verified, limited and incomplete. No unsupported feature remains advertised as complete.

## 20. Sources and factual verification

Canonical rules: https://github.com/Arkiv-Network/global-tour-stop-pre-devcon
Rubric: https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/scoring-rubric.md
Rules: https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/RULES.md
Checklist: https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/submission-checklist.md
Arkiv documentation: https://docs.arkiv.network/
SDK issues: https://github.com/Arkiv-Network/arkiv-sdk-js/issues
Reported issues: https://github.com/Arkiv-Network/reported-issues

Problem-reporting leads from the original proposal, pending source verification before publication:
- https://m.thewire.in/article/government/rti-portal-rtionline-years-of-information-disappears
- https://www.nationalheraldindia.com/amp/story/national/rti-years-of-data-go-missing-from-the-union-governments-information-portal
- https://www.medianama.com/2017/08/223-india-blocks-access-internet-archive-wayback-machine/

Remove unverified assertions about named judges, past winners, novelty across all past submissions and the June 2026 study from the pitch. They are unnecessary to the product case. Recheck canonical rules before submission; do not treat this PRD as the rules source.
