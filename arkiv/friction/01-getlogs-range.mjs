// Repro: eth_getLogs rejects wide block ranges with a generic error.
//   node arkiv/friction/01-getlogs-range.mjs
const RPC = process.env.ARKIV_RPC_URL || "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
const call = async (method, params) => (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()
const head = BigInt((await call("eth_blockNumber", [])).result)
for (const span of [100n, 1000n, 2000n, 5000n, 10000n]) {
  const r = await call("eth_getLogs", [{ address: "0x4400000000000000000000000000000000000044", fromBlock: `0x${(head - span).toString(16)}`, toBlock: `0x${head.toString(16)}` }])
  console.log(`span ${span}:`, r.error ? `ERROR ${r.error.code} ${r.error.message}` : `${r.result.length} logs`)
}
