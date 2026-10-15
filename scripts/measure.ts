/**
 * Latency measurements against Tiramisu, correlated to the exact entity and transaction.
 *
 *   node --env-file=.env --import tsx scripts/measure.ts [runs=5]
 *
 * For each run the RENEWER extends a labelled control entity (created by PUBLISHER with
 * permissionless extension) and records:
 *   submit→receipt     broadcast (eth_sendRawTransaction returned) to receipt available
 *   receipt→query      receipt to arkiv_query returning the new $expiresAt (bounded polling)
 *   receipt→ws event   receipt to an ExpiryExtended event for the same key and tx on a separate
 *                      WebSocket client (negative = the event arrived before our receipt poll)
 * Writes evidence/measure-<timestamp>.json. Failures and timeouts are recorded, never filled in.
 */
import { ExpirationTime, createWalletClient, jsonToPayload } from "@arkiv-network/sdk"
import { i32, str } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { politeHttp } from "muniment-query"
import { custom } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { Evidence, errorText, poll, publicClient, rpcUrl, sleep, wallet, wsClient } from "./lib.js"

const RUNS = Number(process.argv[2] ?? 5)
const ev = new Evidence("measure")

function timedWallet() {
  const inner = politeHttp(rpcUrl(), { concurrency: 1, attempts: 12, maxWaitMs: 12 * 60_000 })({ chain: tiramisu })
  let sentAt = 0
  const transport = custom({
    async request(args: { method: string; params?: unknown }) {
      const out = await inner.request(args as never)
      if (args.method === "eth_sendRawTransaction") sentAt = performance.now()
      return out
    },
  })
  const client = createWalletClient({ chain: tiramisu, transport, account: privateKeyToAccount(process.env.RENEWER_KEY as `0x${string}`) })
  return { client, sentAt: () => sentAt }
}

async function main() {
  const pub = wallet("PUBLISHER")
  const control = await pub.createEntity({
    payload: jsonToPayload({ synthetic: true, control: "latency", note: "Muniment measurement control. Not an archive record." }),
    contentType: "application/json",
    attributes: { app: str("muniment-archive"), schema: i32(1), kind: str("control"), label: str("latency-control") },
    expires: ExpirationTime.fromHours(6),
    flags: { readonly: true, permissionlessExtension: true },
  })
  console.log(`control ${control.entityKey} (tx ${control.txHash})`)

  const events = new Map<string, number>()
  const ws = wsClient()
  const unwatch = ws.watchEntityEvents({
    onExpiryExtended: (e) => {
      if (e.entityKey.toLowerCase() === control.entityKey.toLowerCase()) events.set(e.transactionHash.toLowerCase(), performance.now())
    },
    onError: (e) => console.log("ws error:", e.message),
  })
  await sleep(3000)

  const runs: Record<string, unknown>[] = []
  const { client, sentAt } = timedWallet()
  for (let i = 0; i < RUNS; i++) {
    try {
      const head = await publicClient.getBlockNumber()
      const target = head + 43_200n + BigInt(i + 1) * 600n
      const res = await client.extendEntity({ entityKey: control.entityKey, expires: ExpirationTime.atBlock(target) })
      const receiptAt = performance.now()
      const submitToReceipt = receiptAt - sentAt()
      const visibleAt = await poll(async () => {
        const q = await publicClient.query(`$key = key(${control.entityKey})`, { select: { key: true, expiresAt: true }, limit: 1 })
        const e = q.entities[0] as { expiresAt?: bigint } | undefined
        return e?.expiresAt !== undefined && e.expiresAt >= target ? performance.now() : null
      }, { timeoutMs: 60_000, startMs: 200, maxMs: 2000 })
      const wsAt = await poll(async () => events.get(res.txHash.toLowerCase()) ?? null, { timeoutMs: 30_000, startMs: 200, maxMs: 1000 })
      const run = {
        run: i + 1,
        txHash: res.txHash,
        targetBlock: target.toString(),
        submitToReceiptMs: Math.round(submitToReceipt),
        receiptToQueryMs: visibleAt === null ? null : Math.round(visibleAt - receiptAt),
        receiptToWsEventMs: wsAt === null ? null : Math.round(wsAt - receiptAt),
      }
      runs.push(run)
      console.log(JSON.stringify(run))
    } catch (err) {
      runs.push({ run: i + 1, error: errorText(err) })
      console.log(`run ${i + 1} failed: ${errorText(err)}`)
    }
    await sleep(4000)
  }
  unwatch()

  const vals = (k: string) => runs.map((r) => r[k]).filter((v): v is number => typeof v === "number")
  const summary = (k: string) => {
    const v = vals(k).sort((a, b) => a - b)
    return v.length ? { n: v.length, min: v[0], median: v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2, max: v[v.length - 1] } : { n: 0 }
  }
  const ok = runs.filter((r) => !r.error).length
  ev.record({
    id: "M1",
    title: `Latency over ${RUNS} correlated renewal runs`,
    expected: "every run measured; failures and timeouts reported as such",
    observed: JSON.stringify({ submitToReceipt: summary("submitToReceiptMs"), receiptToQuery: summary("receiptToQueryMs"), receiptToWsEvent: summary("receiptToWsEventMs"), failedRuns: RUNS - ok }),
    outcome: ok === RUNS ? "pass" : "fail",
    txHashes: [control.txHash, ...runs.map((r) => r.txHash as string).filter(Boolean)],
    entityKeys: [control.entityKey],
    data: { runs },
  })
  ev.save()
  process.exit(0)
}

main().catch((err) => {
  console.error(errorText(err))
  process.exit(1)
})
