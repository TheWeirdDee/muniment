/** Read-only, real block-boundary regression for MUN-AUD-001. No wallets or writes. */
import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { createArchiveReader, decodeReply, politeHttp, replyQuery, scan, type ArchiveClient } from "muniment-query"
import { Evidence, sleep } from "./lib.js"
const ev = new Evidence("audit-pagination")
const client = createPublicClient({ chain: tiramisu, transport: politeHttp(tiramisu.rpcUrls.default.http[0], { attempts: 1, maxWaitMs: 1000 }) })
async function advance(block: bigint) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) { if (await client.getBlockNumber() > block) return; await sleep(500) }
  throw new Error("Head did not advance within 20 seconds")
}
async function main() {
 if (await client.getChainId() !== 7738577) throw new Error("Not Tiramisu")
 const filters = { creators: ["0x817574740F413816636FAE23064607084e2C0604"] }
 const reader = createArchiveReader(client as unknown as ArchiveClient)
 const first = await reader.searchReplies(filters, { limit: 10 })
 if (!first.cursor) throw new Error("No continuation available to test")
 await advance(first.blockNumber)
 const second = await reader.searchReplies(filters, { limit: 10, cursor: first.cursor, atBlock: first.blockNumber })
 const blocks: string[] = []
 const delayed: ArchiveClient = { ...client as unknown as ArchiveClient, query: async (q, options) => {
   if (options?.cursor) await advance(options.atBlock!)
   const r = await (client as unknown as ArchiveClient).query(q, options)
   blocks.push(String(r.blockNumber)); return r
 } }
 const result = await scan(delayed, replyQuery(filters), decodeReply, { pageSize: 10, maxPages: 10 })
 ev.record({ id: "MUN-AUD-001", title: "Delayed page and bounded scan retain the first block", expected: "Second page at first block; complete unique corpus and identical scan blocks", observed: JSON.stringify({ firstBlock: String(first.blockNumber), secondBlock: String(second.blockNumber), records: result.records.length, unique: new Set(result.records.map((r)=>r.key)).size, issues: result.issues, blocks, complete: result.complete }), outcome: second.blockNumber === first.blockNumber && result.complete && result.records.length === 41 && result.issues.length === 0 && new Set(blocks).size === 1 ? "pass" : "fail" })
 ev.save()
 if (ev.items.some((i)=>i.outcome !== "pass")) process.exitCode = 1
}
main().catch((error) => { ev.record({ id:"ABORT", title:"Read-only audit verification", expected:"complete", observed:String(error), outcome:"blocked" }); ev.save(); process.exitCode=1 })
