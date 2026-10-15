# Measured Arkiv behaviour (Tiramisu)

What we observed, how, and with how many samples. Small samples are reported as small samples, without invented percentiles.

## Environment

- Client: Node 24.13.1, Windows 11, a consumer internet connection (location not recorded; no IP is logged).
- `@arkiv-network/sdk@0.8.1`, `viem@2.57.7`. Endpoint: the public `https://rpc.tiramisu.db-chain.testnet.arkiv.network` (HTTP) and `wss://…` (WebSocket).
- Date: 15 October 2026, around 22:54 UTC.
- Script: [`scripts/measure.ts`](scripts/measure.ts). Raw data: [`evidence/measure-2026-10-15T22-54-03-562Z.json`](evidence/measure-2026-10-15T22-54-03-562Z.json).

## Method

A labelled control entity (`kind = "control"`, created by the publisher with permissionless extension, tx `0x4c808b71…dc06`) was extended five times by the renewer, each run to a distinct absolute target block. Every timing is correlated to that entity key **and** that transaction hash. Unrelated events are ignored.

| Interval | Start | End |
|---|---|---|
| submit → receipt | `eth_sendRawTransaction` returned | SDK `extendEntity` resolved (viem receipt polling) |
| receipt → query | receipt in hand | `arkiv_query $key = key(…)` returns `$expiresAt >= target` (polling from 200 ms with backoff, 60 s deadline) |
| receipt → other client | receipt in hand | a **separate** WebSocket client (`watchEntityEvents`, no `fromBlock`) has delivered `ExpiryExtended` for this key and tx |

## Results (n = 5, 0 failures)

| Interval | min | median | max |
|---|---|---|---|
| submit → receipt | 4,734 ms | 4,783 ms | 7,140 ms |
| receipt → query visibility | 211 ms | 222 ms | 272 ms |
| receipt → WebSocket event on another client | −3,883 ms | −3,337 ms | −2,487 ms |

Reading the numbers:

- **The WebSocket event arrives about 3 seconds before our receipt poll resolves.** The negative values mean the second client knew about the extension before the sending client's `waitForTransactionReceipt` returned. Inclusion is fast (2-second blocks); much of the ~4.8 s "submit → receipt" is viem's polling interval, not chain latency.
- **Query visibility follows the receipt almost immediately** (≈0.2 s, about one round trip). Muniment still reads the new expiry back before saying a renewal is done.

Transactions: `0x3cb06e4a…67e1`, `0x5ad4f153…ab9d`, `0xd198aeb0…9f1b`, `0x2f660cae…6874`, `0xc78431ac…c439`.

## Limits observed

| Limit | Observed | Source |
|---|---|---|
| Page size | 200 entities per `arkiv_query` page; 100 by default | docs, confirmed |
| `eth_getLogs` | at most 20,000 results; a wider range fails with `-32602 … retry with the range a-b` | [friction #3](arkiv/friction.md#3-eth_getlogs-range-limit-the-node-is-clear-the-client-wrapper-is-not) |
| Rate limit, all methods | `RateLimit: limit=600, remaining=…, reset≈60` | response headers |
| Rate limit, `arkiv_query` | `RateLimit: limit=10000, remaining=0, reset=408` plus `Retry-After` once exhausted from one IP | response headers; [friction #1](arkiv/friction.md#1-public-rpc-windowed-query-budget-documented-only-in-headers) |
| `Arkiv-Cost` | listed in `Access-Control-Expose-Headers`, never present on responses we saw | headers |
| Block time | 2 s nominal; `arkiv_getBlockTiming` reported 2 s | RPC |
| Atomic batch size used | up to 9 creates + 9 ownership changes per transaction in seeding, without error | seed run |
| Expiry precision | a 45-block control disappeared at exactly head ≥ expiry block (observed at the first poll past it) | proof P8 |

## Not measured

- Throughput under load, and behaviour with an access key (we used only the keyless public endpoint).
- A second provider: none was tested.
- Long-run reconnect behaviour of the WebSocket over hours.
