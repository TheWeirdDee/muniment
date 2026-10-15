/** Read the live archive back through muniment-query exactly as the apps do. */
import { createArchiveReader, type ArchiveClient } from "muniment-query"
import { address, publicClient } from "./lib.js"
const r = createArchiveReader(publicClient as unknown as ArchiveClient)
const s = await r.scanReplies({ creators: [address("PUBLISHER")] }, { maxPages: 5 })
console.log(JSON.stringify({ replies: s.records.length, complete: s.complete, issues: s.issues.length, block: s.blockNumber?.toString(), sealed: s.records.filter((x) => x.owner?.toLowerCase() === "0x000000000000000000000000000000000000dead").length }))
const one = s.records.find((x) => x.outcome === "denied")!
const l = await r.getLinked(one.key)
console.log(JSON.stringify({ sample: one.key, title: one.payload.title, appeals: l.appeals.length, exemptions: l.exemptions.length, reviews: l.reviews.length, complete: l.complete }))
