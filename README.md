# Muniment

**Public answers. Worth keeping.** Muniment helps journalists and civic groups find, cite and keep government replies available, even when the original website or uploader disappears. Anyone can pay to renew a record's storage, nobody can rewrite it, and independent tools can read it without this website.

> **Hackathon edition.** Every record is **synthetic test data** (invented authorities, figures and dates) on the **Arkiv Tiramisu testnet** (chain ID 7738577). The storage, renewals and transactions are real; the documents are not.

| | |
|---|---|
| Live app | https://muniment-archive.vercel.app |
| Separate dashboard (second app) | https://muniment-insights.vercel.app |
| Standalone reader | https://muniment-archive.vercel.app/reader.html · source [`reader/reader.html`](reader/reader.html) |
| Data contract | [`arkiv/schema.md`](arkiv/schema.md) |
| Friction report | [`arkiv/friction.md`](arkiv/friction.md) |
| Evidence | [`docs/testing.md`](docs/testing.md) · [`evidence/`](evidence/) |
| Query package | [`packages/muniment-query`](packages/muniment-query) · [release tarball](https://github.com/TheWeirdDee/muniment/releases/tag/muniment-query-v0.1.1) (not on npm) |
| Demo film (1:44) | [muniment-demo.mp4](https://github.com/TheWeirdDee/muniment/releases/download/demo-2026-10-16/muniment-demo.mp4) · [captions](demo/muniment-demo.srt) |

Built for the Arkiv Global Tour Stop (9–18 October 2026). Tracks: **Censorship Resistance** and **Open Source**.

## What it does

1. **Find a reply.** Filter by authority, jurisdiction, topic, outcome, exemption section, filing date or completed response time. Every filter is an Arkiv query on typed attributes, sent from your browser.
2. **Inspect provenance.** Each record shows the claimed issuer separately from the on-chain publisher (`$creator`), the source status, reviews by wallets, corrections, appeals, flags, ownership and the creation transaction.
3. **Save to a collection.** Browser-only collections with JSON export and import.
4. **Renew storage.** Any wallet can move a record's expiry block later, together with its linked appeals and exemption notes, in one atomic transaction that also writes a receipt. Receipts count only when verified against the transaction.
5. **Read independently.** One self-contained HTML file queries the same records over raw JSON-RPC; a separately hosted dashboard reuses the public contract.

## How it uses Arkiv

| Feature | Use |
|---|---|
| Typed attributes vs payload | Filters live in `str`/`u64`/`i32`/`key` attributes (numeric ranges on `filed_ms`, `response_days`, `$expiresAt`); text lives in the JSON payload |
| Queries | Compound predicates, ranges, `$creator` allowlists, `$key` lookups, cursor pagination |
| Creation flags | `readonly` + `permissionlessExtension` on records, so strangers can renew but nobody can edit |
| Ownership transfer | Sealing: ownership goes to `0x…dEaD` in the creating batch, because read-only does not stop owner deletion |
| Entity expiration | Different lifetimes per kind (see the schema); the preserve queue is a range query on `$expiresAt` |
| Lifetime extension | Renewals with absolute `atBlock` targets |
| Atomic batches | Reply + exemption relations + appeals + seal in one transaction; renewals bundle extensions and a receipt |
| `$creator` | Trust filter, provenance display and renewal attribution |
| WebSocket events | Record pages refresh on `watchEntityEvents` over a WebSocket transport, with a labelled fallback |

## Quick start

Prerequisites: Node 20.19+ (tested on 24.13), npm 11.

```bash
git clone https://github.com/TheWeirdDee/muniment && cd muniment
npm ci
npm run build -w muniment-query
npm test                                   # unit tests (schema, queries, renewal, verification, encoder, collections)
npm run dev -w muniment-web                # http://localhost:5173 (reads the live public archive)
npm run dev -w muniment-insights           # the separate dashboard
```

No environment variables are needed to read. To publish, seed or run the proof campaign, copy `.env.example` to `.env` and add **testnet-only** keys for four wallets funded from the [Arkiv faucet](https://hub.arkiv.network/faucet):

```bash
npm run seed       # publish the synthetic corpus (refuses to duplicate an existing one)
npm run proof      # permission, sealing, atomicity, forged-receipt and expiry tests → evidence/proof-*.json
npm run measure    # latency measurements → evidence/measure-*.json
```

Optional web build variables: `VITE_TRUSTED_PUBLISHERS`, `VITE_TRUSTED_REVIEWERS`, `VITE_SITE_URL`, `VITE_DASHBOARD_URL`. None are secrets.

## Reproduce the core claim

1. Open a record, for example from https://muniment-archive.vercel.app/archive. Note its expiry block and owner (`0x…dEaD` = sealed).
2. Run the query in [`arkiv/schema.md`](arkiv/schema.md#reproduce-with-curl) with curl: the same entities come back with their `$creator`.
3. Renew it from any funded wallet (Record → Renew storage), or run `npm run proof`, which extends with a different wallet and shows that the owner-only control rejects the same extension.
4. Open `reader.html` from disk, with the main site blocked if you like, and read the same key.

Exact evidence (wallets, entity keys, transactions, pass/fail) is in [`docs/testing.md`](docs/testing.md).

## Repository layout

```
apps/web            main app (React, Vite)      apps/dashboard   second app (vanilla TS)
packages/muniment-query   shared contract and reader       reader/reader.html   standalone reader
scripts/            seed, proof, measurements   arkiv/            schema, friction report, repros
corpus/sources      synthetic source fixtures   docs/             architecture, threat model, testing, design
evidence/           manifest and machine-readable results
```

## If you see "rate limiting this connection"

The public Tiramisu endpoint gives each IP address a query budget per window (observed: 10,000 units, about an hour; see [friction #1](arkiv/friction.md)). When it runs out, Muniment says so and how long to wait, instead of showing an empty archive. Wait for the stated time, or set your own Arkiv endpoint under Settings. Nothing on chain is affected.

## Limitations

- Synthetic data only. The publish page accepts templated synthetic content and nothing else.
- Renewal is not permanence; records leave queries at their expiry block unless renewed.
- Sealing relies on the assumption that nobody holds a key for `0x…dEaD`. Two demo records are left publisher-held on purpose.
- Reads use the public Tiramisu endpoint, which rate limits per IP. Only one provider was tested.
- Text search covers downloaded records only. Non-chain sorting covers loaded records only.
- No background reminders; nothing is sent to anyone.
- Wallets are not people. All team wallets are labelled test wallets.

More: [`docs/threat-model.md`](docs/threat-model.md) · [`docs/architecture.md`](docs/architecture.md) · [`docs/deployment.md`](docs/deployment.md) · [`docs/submission.md`](docs/submission.md).

## Licence

MIT. Third-party notices: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
