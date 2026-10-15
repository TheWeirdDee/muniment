/**
 * Probe whether a plain GLM value transfer between two EOAs is accepted on Tiramisu, and if so fund
 * the STRANGER test wallet from the REVIEWER wallet.
 *   node --env-file=.env --import tsx scripts/fund-stranger.ts [amountGlm]
 */
import { parseEther, formatEther } from "viem"
import { address, errorText, publicClient, wallet } from "./lib.js"

const amount = parseEther(process.argv[2] ?? "1")
const from = wallet("REVIEWER")
const to = address("STRANGER")
const before = await publicClient.getBalance({ address: to })
try {
  const hash = await from.sendTransaction({ to, value: amount })
  const rcpt = await publicClient.waitForTransactionReceipt({ hash })
  const after = await publicClient.getBalance({ address: to })
  console.log(JSON.stringify({ hash, status: rcpt.status, gasUsed: rcpt.gasUsed.toString(), strangerBefore: formatEther(before), strangerAfter: formatEther(after) }))
} catch (err) {
  console.log(JSON.stringify({ error: errorText(err) }))
}
