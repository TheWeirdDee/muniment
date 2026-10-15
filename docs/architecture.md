# Architecture

Muniment is static and browser-based. There is no Muniment server or database in the read, write, search, provenance or renewal path.

```
                      ┌────────────────────────── Arkiv Tiramisu (chain 7738577) ──────────────────────────┐
                      │  entities: reply · appeal · exemption · receipt · review  (namespace muniment-archive) │
                      └───────▲───────────────▲──────────────────▲───────────────────────▲─────────────────┘
          arkiv_query /       │               │ eth_sendTransaction  │ eth_subscribe (logs) │ arkiv_query (raw JSON-RPC)
          eth_getLogs         │               │ (user's wallet)      │                      │
┌─────────────────────────────┴───────────────┴──────────────────────┴───────┐   ┌──────────┴───────────┐
│ apps/web  (muniment-archive.vercel.app, static)                          │   │ reader/reader.html   │
│   React + react-router · @arkiv-network/sdk public, WebSocket and         │   │ one self-contained   │
│   wallet clients · muniment-query for schema, queries, renewal, verify   │   │ HTML file, no SDK    │
└──────────────────────────────────────────────────────────────────────────┘   └──────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/dashboard  (muniment-insights.vercel.app, a separate static site)    │
│   vanilla TypeScript · muniment-query + SDK · reads the public contract   │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ scripts/  (Node, operator only)  seed · proof campaign · measurements    │
│   keys from .env, never shipped to a browser                              │
└──────────────────────────────────────────────────────────────────────────┘
```

## Modules

| Path | Responsibility |
|---|---|
| `packages/muniment-query/src/schema.ts` | Versioned types and validators. Treats every entity as untrusted input |
| `normalize.ts` | One entity shape from SDK objects or raw JSON-RPC |
| `queries.ts` | Query strings (with escaping and input checks); the same text runs in the SDK, raw RPC, the reader and the docs |
| `reader.ts` | Paged and bounded reads, deduplication, linked records, lookup states (found, missing, malformed, unsupported, invalid key) |
| `renewal.ts` | Pure renewal planning: classification, atomic units, batch packing, receipt payloads |
| `encode.ts` | Calldata from the documented wire format, used only for gas estimates; tested byte-for-byte against the SDK |
| `verify.ts` | Renewal-receipt verification and creation-transaction lookup |
| `collections.ts` | Export format and defensive import |
| `status.ts` | Derived review status and waiting time |
| `transport.ts` | Rate-limit-aware JSON-RPC transport (honours `Retry-After`) |
| `apps/web/src/lib/wallet.tsx` | EIP-6963 discovery, connection, network switching, signing; the transport wrapper reports the tx hash at broadcast |
| `apps/web/src/lib/renew.ts` | Discovery → plan → gas quote → stale check → signed batch → visibility → verification |
| `apps/web/src/lib/live.ts` | `watchEntityEvents` over WebSocket (no `fromBlock`), with a labelled fallback to periodic reconciliation |

## Trust boundaries

- **Chain data is untrusted.** Decoders validate types and sizes; text is rendered as text.
- **The namespace is not authorship.** Trust is `$creator` against a configured allowlist.
- **Receipts are claims** until verified against execution.
- **Browser storage is the user's**: collections and notes never leave it.
- **Keys** exist only in the operator's `.env` (scripts) and in users' own wallets.

## Decisions

| Decision | Why |
|---|---|
| Raw query strings rather than SDK expression objects | One text runs everywhere (SDK, curl, reader, docs) and can be copied by judges |
| Relation entity per exemption section | Arkiv has no list attribute; this makes secondary sections searchable |
| Sealing via `changeOwnership` to `0x…dEaD` in the same batch | Read-only alone does not stop owner deletion |
| Absolute `atBlock` expiries for renewals | The receipt can state the exact block the engine will record |
| Own calldata encoder for estimates | The SDK's attribute encoders are internal; estimates must use the exact calldata |
| Static prerendered HTML per route | Correct share metadata without a server |
| Two Vercel projects | The dashboard must be served from a different origin to show independent reuse |
| Polite transport | The public endpoint rate limits per IP; bursts would otherwise fail |
