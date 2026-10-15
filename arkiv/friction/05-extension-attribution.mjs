// Repro: ExpiryExtended's indexed `owner` is the entity owner, not the wallet that paid for the
// extension, so attribution needs the transaction sender. Pass a renewal tx hash.
//   node arkiv/friction/05-extension-attribution.mjs <txHash>
const RPC = process.env.ARKIV_RPC_URL || "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
const call = async (method, params) => (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()
const r = (await call("eth_getTransactionReceipt", [process.argv[2]])).result
console.log("tx.from:", r.from)
for (const l of r.logs) console.log("log topic0", l.topics[0].slice(0, 10), "entity", l.topics[1]?.slice(0, 12), "indexed owner", "0x" + (l.topics[2] ?? "").slice(26))
