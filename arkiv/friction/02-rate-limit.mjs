// Repro: the public endpoint's two rate limits and per-method cost headers.
// Prints RateLimit / Arkiv-Cost headers for a cheap and an expensive query. Safe: read-only.
//   node arkiv/friction/02-rate-limit.mjs
const RPC = process.env.ARKIV_RPC_URL || "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
async function probe(label, method, params) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })
  console.log(label.padEnd(42), res.status, "| RateLimit:", res.headers.get("ratelimit"), "| Arkiv-Cost:", res.headers.get("arkiv-cost"), "| Retry-After:", res.headers.get("retry-after"))
}
const q = "app = str('muniment-archive') AND kind = str('reply')"
await probe("eth_blockNumber", "eth_blockNumber", [])
await probe("arkiv_query keys only, limit 10", "arkiv_query", [q, { limit: "0xa", select: { key: true } }])
await probe("arkiv_query attributes, limit 50", "arkiv_query", [q, { limit: "0x32", select: { key: true, attributes: true } }])
await probe("arkiv_query attributes+payload, limit 200", "arkiv_query", [q, { limit: "0xc8", select: { key: true, attributes: true, payload: true } }])
await probe("arkiv_getEntityCount", "arkiv_getEntityCount", [])
