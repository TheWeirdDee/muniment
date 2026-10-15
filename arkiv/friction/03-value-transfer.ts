// Repro: a plain GLM value transfer between two externally owned accounts succeeds on Tiramisu,
// although the fundamentals page says only transactions to the Arkiv operation address are accepted.
// Spends 0.001 test GLM.   node --env-file=.env --import tsx arkiv/friction/03-value-transfer.ts
import { createWalletClient, createPublicClient, http, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { tiramisu } from "@arkiv-network/sdk/chains"
const account = privateKeyToAccount(process.env.REVIEWER_KEY as `0x${string}`)
const w = createWalletClient({ account, chain: tiramisu, transport: http() })
const p = createPublicClient({ chain: tiramisu, transport: http() })
const hash = await w.sendTransaction({ to: process.env.STRANGER_ADDRESS as `0x${string}`, value: parseEther("0.001") })
console.log(hash, (await p.waitForTransactionReceipt({ hash })).status)
