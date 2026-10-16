# Muniment data contract on Arkiv (schema v1)

This is the authoritative description of every Arkiv entity Muniment writes and reads on the **Tiramisu testnet** (chain ID `7738577`). The executable form is [`packages/muniment-query/src/schema.ts`](../packages/muniment-query/src/schema.ts) (validators) and [`queries.ts`](../packages/muniment-query/src/queries.ts) (query builders). Everything below was checked against `@arkiv-network/sdk@0.8.1` and the live node in October 2026.

All records in the deployed edition are **synthetic**: invented authorities, figures and dates. No real personal data is stored on Arkiv.

## Namespace and trust

Every Muniment entity carries:

| Attribute | Type | Value |
|---|---|---|
| `app` | `str` | `muniment-archive` |
| `schema` | `i32` | `1` |
| `kind` | `str` | `reply`, `appeal`, `exemption`, `receipt` or `review` |

The namespace is for discovery only. Anyone can write entities with these attributes, so **trust comes from the on-chain creator** (`$creator`), which Arkiv records at creation and which nobody can change. The archive filters by the creator wallets the deployment trusts (default: the publisher wallet below). Readers can widen the view to every wallet, and untrusted records are labelled.

Decoders reject anything that fails the contract: wrong types, missing fields, oversize payloads (over 64 KiB), unsafe URLs, a `no-reply` record with a reply date, or an unsupported `schema` version (reported separately as "unsupported", not "malformed").

## Units

| Quantity | Unit |
|---|---|
| `filed_ms`, `replied_ms` | UTC milliseconds since the Unix epoch, at UTC midnight of the stated date |
| `response_days` | whole days from filing to reply |
| `$expiresAt`, `$createdAt`, `target_expiry` | Arkiv block height (`u64`). Nominal block time is 2 seconds, so 43,200 blocks ≈ 1 day. Every date shown for a block is approximate. |

## Entity types

### `reply`: one government reply (or an unanswered request)

| Attribute | Type | Notes |
|---|---|---|
| `synthetic` | `bool` | always `true`; required by the decoder |
| `authority` | `str` | slug of the claimed issuing authority, e.g. `ravipur-mc` |
| `jurisdiction` | `str` | e.g. `sundarvan` (fictional) |
| `topic` | `str` | `roads`, `drainage`, `streetlights`, `contracts`, `bridges` |
| `outcome` | `str` | `granted`, `partial`, `denied`, `transferred`, `no-reply` |
| `language` | `str` | `en` |
| `filed_ms` | `u64` | range-queryable |
| `replied_ms` | `u64` | **absent** for `no-reply` |
| `response_days` | `i32` | **absent** for `no-reply`, so unanswered requests never enter response-time ranges |
| `exemption` | `str` | primary exemption section, e.g. `8(1)(j)`; all sections are also relation entities |
| `ref` | `str` | claimed reference number |
| `corrects` | `key` | only on corrections: the key of the record it restates |

Payload (`application/json`): `schema: "muniment.reply/1"`, `synthetic: true`, `title`, `question`, `answer` (null for `no-reply`), `authorityName`, `jurisdictionName`, `claimedSource { reference, url, documentDate, status }`, `attachment` (always null in this edition), `exemptions[]`, `correction { of, reason }` or null, `disclosure`.

Flags: **read-only + permissionless extension**. Creation lifetime is a writer policy, not a decoder bound: the seeded corpus uses 21–180 days; the public Publish form offers 7, 30, 90 or 180 days (`ExpirationTime.fromDays`). Renewals extend an existing record. The seeded corpus retention policy beyond judging is separate from user-selected lifetimes.

**Sealing.** For 39 of the 41 seeded replies (and their linked records) the publishing batch also transfers ownership to `0x000000000000000000000000000000000000dEaD`, a conventional burn address widely assumed to have no usable private key. Read-only alone does not stop the owner deleting an entity; sealing removes the publisher's delete and transfer rights while that assumption holds (tested: P3d, P3f in [docs/testing.md](../docs/testing.md)). Two replies (`r04`, `r18`) are deliberately left publisher-held.

### `exemption`: one row per exemption section cited

| Attribute | Type |
|---|---|
| `reply` | `key` |
| `section` | `str` |

Empty payload (`application/octet-stream`). Arkiv has no list type, so one relation entity per section makes **every** section searchable, not only the primary one. Flags: read-only + permissionless extension. Created in the same transaction as its reply with the same relative lifetime, so it lands on the **same expiry block**.

### `appeal`: a first or second appeal against a reply

| Attribute | Type |
|---|---|
| `reply` | `key` |
| `stage` | `str`: `first-appeal`, `second-appeal` |
| `filed_ms` | `u64` |
| `outcome` | `str`: `pending`, `allowed`, `dismissed`, `remanded` |

Payload: `schema: "muniment.appeal/1"`, `synthetic`, `grounds`, `decision`, `disclosure`. Flags: read-only + permissionless extension (checked per entity, never assumed from the parent). Expiry: same block as its reply at creation.

### `receipt`: a public claim that a renewal happened

| Attribute | Type |
|---|---|
| `reply` | `key` |
| `target_expiry` | `u64` block the renewal set |

Payload: `schema: "muniment.receipt/1"`, `note`, `extendedCount`. Flags: read-only. Expiry: exactly `target_expiry` (`ExpirationTime.atBlock`), so a receipt lives as long as the coverage it claims.

A receipt is created **in the same atomic transaction** as the extensions it describes. It is only counted as a verified renewal when chain execution proves it ([algorithm](#verified-renewal-algorithm)).

### `review`: a statement by a wallet about a reply

| Attribute | Type |
|---|---|
| `reply` | `key` |
| `status` | `str`: `source-compared`, `disputed` |

Payload: `schema: "muniment.review/1"`, `method`, `limitations`, `evidenceRef`, `observedAt`. Flags: read-only + permissionless extension. Lifetime: 365 days, independent of the reply.

Status shown for a reply is **derived**, never stored: `superseded` if its own creator published a correction; else `disputed` / `source-compared` from reviews by reviewers the reader trusts; else `unreviewed`. Reviews from other wallets are shown and labelled, not counted.

## Expiry policy

| Kind | Initial lifetime | Why |
|---|---|---|
| reply | 21, 30, 45, 90 or 180 days | Mixed on purpose, so the preserve queue has records near expiry while all demo records outlive judging (earliest ≈ 5 Nov 2026) |
| exemption, appeal | same block as reply | they renew together with it |
| receipt | its `target_expiry` | the claim lives exactly as long as the coverage |
| review | 365 days | independent statements outlive one renewal cycle |
| control (proof campaign only) | 45 blocks to 12 hours | permission and expiry tests; `kind = "control"`, never shown as records |

## Renewal transaction

One atomic `executeBatch` per group of up to 24 operations:

```
creates:    [ receipt { reply = K, target_expiry = T }  expires atBlock(T) ]   (one per reply)
extensions: [ K → atBlock(T), each linked appeal/exemption by the same creator → atBlock(T) ]
```

`atBlock(T)` is absolute, so the receipt's stated target equals the block the engine records. Arkiv rejects an extension that would not move the expiry later (`ExpiryNotExtended`), so records that already live past `T` are left out of the plan rather than sent.

## Verified renewal algorithm

Implemented in [`verify.ts`](../packages/muniment-query/src/verify.ts):

1. Read the receipt with `creator` and `createdAt`.
2. `eth_getLogs` at block `createdAt`, address `0x4400…0044`, topics `[EntityCreated, receiptKey]`. Exactly one log leads to the creating transaction.
3. `eth_getTransactionReceipt`: the status must be success, and `from` must equal the receipt's `$creator`.
4. The same receipt must contain an `ExpiryExtended` log for the receipt's `reply` key, with `expiresAt == target_expiry`.

Anything else is a **"renewal claim, unverified"** and is excluded from counts. A standalone receipt fails step 4; a borrowed transaction hash cannot be attached, because the transaction is found from the receipt's own creation log. Counts are of distinct wallets, not people, and cover only receipts that are still live.

## Queries the app runs

Exact strings, as produced by `queries.ts` (`P` = trusted publisher `0x817574740F413816636FAE23064607084e2C0604`):

```text
# Archive search (compound filters; numeric ranges on typed attributes)
app = str('muniment-archive') AND schema = i32(1) AND kind = str('reply') AND synthetic = true
  AND outcome = str('denied') AND response_days >= i32(31) AND response_days <= i32(60)
  AND filed_ms >= u64(1767225600000) AND filed_ms <= u64(1774915200000)
  AND $creator = addr(P)

# Any exemption section (primary or secondary) via relation entities
app = str('muniment-archive') AND schema = i32(1) AND kind = str('exemption') AND section = str('8(1)(j)') AND $creator = addr(P)

# Preserve queue: replies expiring between the head block H and H + days × 43200
app = str('muniment-archive') AND schema = i32(1) AND kind = str('reply') AND $expiresAt >= u64(H) AND $expiresAt <= u64(H2) AND $creator = addr(P)

# Everything linked to reply K (appeals, exemptions, receipts, reviews) in one read
app = str('muniment-archive') AND schema = i32(1) AND reply = key(K)

# Corrections of K (supersession requires the same creator as K)
app = str('muniment-archive') AND schema = i32(1) AND kind = str('reply') AND corrects = key(K)

# One entity by key
$key = key(K)
```

Pagination: `limit` up to 200 with the returned `cursor`; results are deduplicated by key across pages. The node returns newest first and supports no other order, so any other sort in the UI is labelled "loaded records only". Text search runs over downloaded records only and says so.

## Reproduce with curl

```bash
curl https://rpc.tiramisu.db-chain.testnet.arkiv.network -H 'content-type: application/json' -d '{
  "jsonrpc":"2.0","id":1,"method":"arkiv_query",
  "params":["app = str('\''muniment-archive'\'') AND schema = i32(1) AND kind = str('\''reply'\'') AND outcome = str('\''denied'\'') AND $creator = addr(0x817574740F413816636FAE23064607084e2C0604)",
            {"limit":"0x14","select":{"key":true,"creator":true,"expiresAt":true,"attributes":true}}]}'
```

Expected at seeding time: 7 refused replies, all created by the publisher wallet.

## Wallets

| Address | Role |
|---|---|
| `0x817574740F413816636FAE23064607084e2C0604` | Publisher: creates every seeded reply, appeal and exemption relation (team test wallet) |
| `0xeC5C622d43217c5DA7C006be11909c0Fb6fFf5C1` | Reviewer: creates the 11 seeded reviews (team test wallet) |
| `0xe0e47735c1add1390E03766D7Bd06eC913485DE7` | Renewer: renews records and creates receipts (team test wallet) |
| `0x5F2b31286708083Aa5D097bD89d5b3F48DD6cBC9` | Stranger: permission and forged-receipt tests (team test wallet) |
| `0x000000000000000000000000000000000000dEaD` | Burn address that sealed records are transferred to (assumed keyless; not a team wallet) |

The full list of seeded entity keys and transactions is in [`evidence/manifest.json`](../evidence/manifest.json).

## What stays off Arkiv

Wallet keys and access credentials, personal data, collections and private notes (browser storage only), saved searches, full-text indexes, and the synthetic source fixtures (in [`corpus/sources/`](../corpus/sources/)).

## Snapshot and duration rules (query package 0.1.1)

Continuation calls must preserve query, projection, page size and the first result's `blockNumber` as `atBlock`. Pass `{ cursor, atBlock }` to `searchReplies`; internal scans pin every continuation and reject a changed block. Restart both cursor and block after changing filters. An expired or unavailable snapshot is an error, not a complete empty scan.

When both timestamps and `response_days` exist, duration must equal `floor((replied_ms - filed_ms) / 86400000)`: whole elapsed UTC days, with partial days rounded down. Missing reply timestamps or duration measurements remain supported; unanswered records carry neither. Contradictory values are decode issues and excluded from analytics.

Linked appeals/exemption relations are independently authored claims. Their creator must be displayed; only eligible same-creator links travel with the reply's renewal. The standalone reader follows up to three 50-record pages per linked kind at the parent read block, labels a bounded result partial, and exports `linkedCoverage` with completeness, cursor, read block and pages.
