# muniment-query

Typed reader, query builders, renewal planner and receipt verifier for the [Muniment](https://muniment-archive.vercel.app) archive on Arkiv's Tiramisu testnet. It implements the data contract in [`arkiv/schema.md`](../../arkiv/schema.md).

**Status:** version 0.1.0. Not published to the npm registry. Install the release tarball attached to the GitHub release `muniment-query-v0.1.0`, or build it from this repository.

## Install

```bash
npm install @arkiv-network/sdk@0.8.1 viem@^2.37
npm install https://github.com/TheWeirdDee/muniment/releases/download/muniment-query-v0.1.0/muniment-query-0.1.0.tgz
```

From source:

```bash
git clone https://github.com/TheWeirdDee/muniment && cd muniment
npm ci && npm run build -w muniment-query && npm pack -w muniment-query
```

Peer dependencies: `@arkiv-network/sdk ~0.8.1` and `viem ^2.37`. ESM only. Node 20.19+ or any modern browser.

## Use

```ts
import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { createArchiveReader, politeHttp, verifyRenewalReceipt, type ArchiveClient } from "muniment-query"

const client = createPublicClient({ chain: tiramisu, transport: politeHttp("https://rpc.tiramisu.db-chain.testnet.arkiv.network") })
const archive = createArchiveReader(client as unknown as ArchiveClient)

const page = await archive.searchReplies(
  { outcome: "denied", creators: ["0x817574740F413816636FAE23064607084e2C0604"] },
  { limit: 20 },
)
for (const r of page.records) console.log(r.key, r.payload.title, r.responseDays)

const linked = await archive.getLinked(page.records[0].key)
for (const receipt of linked.receipts) console.log(await verifyRenewalReceipt(client as unknown as ArchiveClient, receipt))
```

## API

| Export | What it does |
|---|---|
| `replyQuery(filters)`, `exemptionQuery`, `expiringQuery`, `allLinkedQuery`, `correctionsQuery`, `keysQuery`, `kindQuery` | Query strings in Arkiv's query language. Throw `QueryInputError` on bad input |
| `createArchiveReader(client)` | `searchReplies`, `scanReplies`, `getReply`, `getReplies`, `getLinked`, `replyKeysForSection`, `head` |
| `decodeReply`, `decodeAppeal`, `decodeExemption`, `decodeReceipt`, `decodeReview`, `decodeAny` | Validate untrusted entities. Return `{ ok, value }` or `{ ok: false, issue }` |
| `verifyRenewalReceipt(client, receipt)`, `checkRenewalReceipt(receipt, txReceipt)` | Renewal attribution (see the algorithm in the schema doc) |
| `planRenewal(candidates, opts)`, `batchToWire`, `encodeExecute`, `estimateCost`, `formatGlm` | Renewal planning and gas-estimate calldata |
| `deriveStatus(reply, linked, trustedReviewers)` | `unreviewed`, `source-compared`, `disputed` or `superseded` |
| `exportCollections`, `importCollections` | Portable collection files with defensive import |
| `politeHttp(url, opts)` | A viem transport that waits out 429s using `Retry-After` |

## Errors

- `getReply` never throws for a missing or bad record. It returns `missing`, `malformed`, `unsupported` or `invalid-key`.
- Network and rate-limit failures throw (`RpcHttpError` from `politeHttp`). Nothing falls back to fixtures.
- `scan` results include `complete: false` when a page bound stopped the walk. Treat such results as partial.

## Compatibility

Schema version 1 (`schema = i32(1)`). Entities with another version are reported as unsupported, not misread.

## Tests

```bash
npm test -w muniment-query
```

The SDK-equivalence test swaps the transport for an in-memory stub to capture calldata. It proves encoding equivalence only; live behaviour is covered by `scripts/proof.ts`.

MIT licence.
