# Friction report: building Muniment on Arkiv

Environment for every entry unless stated: `@arkiv-network/sdk@0.8.1`, `viem@2.57.7`, Node 24.13.1 on Windows 11, Tiramisu testnet (chain 7738577) via `https://rpc.tiramisu.db-chain.testnet.arkiv.network`, 15 October 2026. Each entry was reproduced; scripts are in [`arkiv/friction/`](friction/). Smooth paths are documented with the same rigour as problems.

## Summary

| # | Surface | Kind | One line |
|---|---|---|---|
| 1 | Public RPC rate limits | Problem | A per-IP windowed budget for `arkiv_query` runs out quickly; it is advertised in headers but not documented |
| 2 | SDK + viem under 429 | Problem | `waitForTransactionReceipt` keeps polling through 429s, so a script appears hung after its transaction was sent |
| 3 | `eth_getLogs` range limit | Problem (client side) | The node's error is clear; viem's wrapper hides it behind "Invalid parameters" |
| 4 | Docs: value transfers | Docs mismatch | Plain GLM transfers between EOAs succeed, although the fundamentals page says other transactions revert |
| 5 | `readonly` and deletion | Working path, worth surfacing | Read-only does not stop owner deletion; sealing via ownership transfer in the creating batch works |
| 6 | Extension attribution | Working path, worth surfacing | `ExpiryExtended.owner` is the owner, not the payer; verification needs `tx.from` |
| 7 | SDK public client typing | Problem | `getGasPrice` / `estimateGas` aren't on the public client type, so gas quotes need raw `request` |
| 8 | Attribute encoders not exported | Problem | Fee estimation for an exact batch needs a re-implemented encoder |
| 9 | Predicted keys + atomic sealing | Smooth | `predictEntityKeys` let one batch create, cross-reference and seal entities |
| 10 | Permissionless extension | Smooth | Stranger extension and owner-only rejection behaved exactly as documented |
| 11 | Atomicity | Smooth | A mined, reverted batch left no partial writes |
| 12 | WebSocket events | Smooth | `watchEntityEvents` over `webSocket()` streamed events immediately |
| 13 | CORS / file origin | Smooth | `Access-Control-Allow-Origin: *`, including `Origin: null`, so a disk-opened HTML reader works |
| 14 | Expiry | Smooth | A 45-block control disappeared from `getEntity` and queries at its expiry block |

---

### 1. Public RPC: windowed query budget, documented only in headers

- **Surface:** public HTTP RPC, `arkiv_query`.
- **Expected:** "heavily rate limited" (docs) to mean a per-minute cap a normal browsing session doesn't hit, with limits documented.
- **Actual:** responses carry `RateLimit: limit=600, remaining=…, reset=<s>` (a per-minute budget across methods) and, for `arkiv_query`, `RateLimit: limit=10000, remaining=0, reset=408` with `Retry-After`. After seeding and some screenshots from one IP, every `arkiv_query` returned **429** while `eth_blockNumber` still succeeded. The first lock-out reported `reset=408`. After the budget was exhausted again during browser testing it reported `reset=2878` (about 48 minutes), which suggests a roughly hourly window of 10,000 units per IP. `Arkiv-Cost` is listed in `Access-Control-Expose-Headers` but was absent on every response we saw, so per-query cost cannot be measured.
- **Repro:** `node arkiv/friction/02-rate-limit.mjs` prints status, `RateLimit` and `Arkiv-Cost` for a cheap and an expensive query; run it after a few hundred queries.
- **Impact:** a public demo can be locked out of reads for the visitor's IP. For a censorship-resistance app, the unauthenticated read path matters most.
- **Suggested fix:** document both budgets and the cost model; populate `Arkiv-Cost` on every response; let the SDK expose a rate-limit-aware transport, or document `Retry-After`.
- **What we did:** `politeHttp` in [`transport.ts`](../packages/muniment-query/src/transport.ts) caps concurrency, honours `Retry-After` and `reset`, and reports the wait. The UI says "rate limited for about N seconds" rather than showing an empty archive. `getLinked` was reduced from five queries to two (one `reply = key(K)` query covers every linked kind).

### 2. A sent transaction looks hung while receipts are rate limited

- **Surface:** `walletClient.executeBatch` → viem `waitForTransactionReceipt`.
- **Expected:** a clear error, or a bounded wait, when receipt polling is rate limited.
- **Actual:** our first proof run stalled for more than 10 minutes after broadcasting its first batch (the publisher nonce had advanced). Receipt polls were getting 429 and being retried silently. The SDK call never resolved or rejected within that time.
- **Repro:** exhaust the query budget (entry 1), then call any write. It broadcasts, then waits.
- **Suggested fix:** pass a `timeout` to `waitForTransactionReceipt` in `sendArkivTransaction` and surface `txHash` in the resulting error, as the SDK already does for count mismatches.
- **What we did:** the scripts' transport waits out the advertised reset with logging, and evidence is written after every step, so an interrupted run still leaves its record. The stalled run is noted in [`docs/testing.md`](../docs/testing.md).

### 3. `eth_getLogs` range limit: the node is clear, the client wrapper is not

- **Surface:** `eth_getLogs` on address `0x4400…0044`.
- **Expected:** a documented maximum range.
- **Actual:** the limit is on **results** (20,000), not blocks. Raw JSON-RPC returns `-32602 query exceeds max results 20000, retry with the range 617501-627080`, which is excellent. Through viem's public client the same failure surfaced as `Invalid parameters were provided to the RPC method`, with the node's hint only in `details`.
- **Repro:** `node arkiv/friction/01-getlogs-range.mjs` (spans of 100–5,000 blocks succeed on today's traffic; 10,000 fails).
- **Suggested fix:** mention the result cap in the JSON-RPC docs and recommend topic filters; in the SDK, re-throw `-32602` with the node message.
- **What we did:** every log lookup is for one block and one entity-key topic (receipt verification, creation-transaction lookup), so it never approaches the cap.

### 4. Plain value transfers succeed, contrary to the fundamentals page

- **Surface:** docs, "A chain with a database engine instead of the EVM": *"A transaction is accepted only if its `to` address is a known Arkiv operation address. Every other transaction reverts."*
- **Actual:** a 1 GLM transfer from one EOA to another succeeded (`0xa73780704f52a91000c369378d96402e652925c12662ac68256f6a0c52f23e65`, status success, gas 21,000), and so did proof step P7.
- **Repro:** `node --env-file=.env --import tsx arkiv/friction/03-value-transfer.ts`.
- **Suggested fix:** clarify that the rule applies to calls carrying data, and that value transfers are allowed. Useful to say, because it lets teams fund test wallets from one faucet claim.

### 5. `readonly` doesn't prevent deletion; sealing does (working path)

- **Surface:** creation flags, `changeOwnership`, `executeBatch`.
- **Expected:** documented, and it is: "readonly does not prevent it". It is easy to miss when designing censorship resistance, though.
- **Tested:** an unsealed read-only entity can be transferred and then deleted by the new owner (P3f). The publisher's delete of an entity whose ownership was moved to `0x…dEaD` **in the same batch** as its creation is rejected with `NotOwner` (P3d). A stranger can still extend it (P3e).
- **Repro:** `node --env-file=.env --import tsx arkiv/friction/04-readonly-delete-and-seal.ts`.
- **Suggestion:** a creation flag such as `nodelete`, or a docs recipe for "publish so nobody can remove it", would make this explicit. The burn-address approach depends on an assumption, not a protocol guarantee.

### 6. Who paid for an extension? (working path)

- **Surface:** `ExpiryExtended(bytes32 indexed entityKey, address indexed owner, uint64 expiresAt)`.
- **Observed:** `owner` is the entity's owner (for sealed records `0x…dEaD`), never the wallet that extended it. The live-events page says so ("not necessarily who extended it").
- **What works:** attribute via the transaction. Find the receipt entity's creating transaction from its `EntityCreated` log at `createdAt`, check that `tx.from` equals the receipt's `$creator`, and look for `ExpiryExtended` for the reply in the same receipt ([`verify.ts`](../packages/muniment-query/src/verify.ts), proof P5).
- **Repro:** `node arkiv/friction/05-extension-attribution.mjs <renewal tx hash>`.
- **Suggestion:** an `extender` field on `ExpiryExtended` would make attribution a single log read.

### 7. SDK public client is missing common viem read actions in its type

- **Surface:** `createPublicClient` from `@arkiv-network/sdk`.
- **Expected:** viem public actions such as `getGasPrice` and `estimateGas`, as with viem's own client.
- **Actual:** TypeScript error `Property 'getGasPrice' does not exist` (and `estimateGas`); `request` works.
- **Workaround:** `client.request({ method: "eth_gasPrice" })` and `eth_estimateGas` by hand ([`renew.ts`](../apps/web/src/lib/renew.ts)).
- **Suggestion:** extend the public client with viem's `publicActions`, or document which actions are included.

### 8. No public encoder for estimating an exact batch

- **Surface:** `@arkiv-network/sdk` exports; the attribute encoders are marked "Internal seam".
- **Need:** show an itemised fee **before** the wallet prompt, for the exact batch that will be signed.
- **What we did:** re-implemented the documented wire format in [`encode.ts`](../packages/muniment-query/src/encode.ts) and proved byte-for-byte equality with the SDK's calldata ([`encode.test.ts`](../packages/muniment-query/test/encode.test.ts)). The JSON-RPC mutation docs were precise enough to do this first time.
- **Suggestion:** export `encodeExecute(params)` or an `estimateBatch(params)` helper.

### 9. Predicted keys made one atomic "publish and seal" batch possible (smooth)

`publicClient.predictEntityKeys({ owner, count })` gave keys and salts for a batch that creates a reply, its exemption relations (which reference the reply's key) and appeals, then transfers all of them to `0x…dEaD`. All 12 seed transactions matched their predictions (the seed script aborts if a key differs). Tested: P1, and the seed run in [`evidence/manifest.json`](../evidence/manifest.json).

### 10. Permissionless extension (smooth)

A different wallet extended a `permissionlessExtension` entity, and the direct read showed the new `$expiresAt` (P2a). The same wallet's extension of an otherwise identical entity without the flag was rejected with a readable `NotOwner` message (P2b). Extending to an earlier block was rejected (P6). The SDK's error messages here are among the clearest we've seen from any chain SDK.

### 11. Atomic batches (smooth)

A batch containing a valid extension, a receipt create and an extension of a deleted entity was sent with explicit gas (to skip pre-flight estimation), mined and reverted. The valid entity's expiry was unchanged, and no receipt existed afterwards (P4a).

### 12. WebSocket events (smooth)

`createPublicClient({ transport: webSocket() }).watchEntityEvents({...})` with no `fromBlock` delivered chain-wide events within seconds (8 in 12 s on a busy testnet). Record pages use it to refresh, and fall back to labelled periodic reconciliation if the socket errors. Expiry fires no event, as documented, so pages also reconcile on a timer.

### 13. CORS allows file-origin readers (smooth)

The preflight answers `Access-Control-Allow-Origin: *` for `Origin: null`, so `reader.html` opened from disk can call `arkiv_query` directly. Tested in the browser suite with the main site's origin blocked.

### 14. Expiry is real and observable (smooth)

A control created with `ExpirationTime.fromBlocks(45)` was read live, and after the head passed its expiry block `getEntity` threw `NoEntityFoundError` and `$key` queries returned nothing (P8). There is no expiry event, so Muniment only says "expired" when a saved observation shows the expiry block has passed.

## The one thing we'd improve first

Document the public RPC's read budgets and populate `Arkiv-Cost`. Censorship-resistant reading depends on the unauthenticated path, and being locked out with no explanation is the failure readers would actually hit.
