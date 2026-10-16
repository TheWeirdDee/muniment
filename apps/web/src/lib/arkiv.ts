/**
 * Arkiv clients for the browser. Reads use a public HTTP client (no key, no Muniment server);
 * live updates use a separate WebSocket client; writes use the user's injected wallet. A user-set
 * endpoint is validated against the Tiramisu chain id before it is used.
 */
import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { createArchiveReader, politeHttp, TIRAMISU, type ArchiveClient } from "muniment-query"
import { webSocket } from "viem"
import { settings } from "./settings"

type Pub = ReturnType<typeof createPublicClient>

let cached: { url: string; client: Pub } | null = null
let cachedWs: { url: string; client: Pub } | null = null

export function publicClient(): Pub {
  const url = settings.get().rpcUrl
  if (!cached || cached.url !== url) {
    cached = { url, client: createPublicClient({ chain: tiramisu, transport: politeHttp(url, { concurrency: 2, maxWaitMs: 20_000, cacheMs: 20_000 }) }) }
  }
  return cached.client
}

export function wsClient(): Pub {
  const url = settings.get().wsUrl
  if (!cachedWs || cachedWs.url !== url) {
    cachedWs = {
      url,
      client: createPublicClient({ chain: tiramisu, transport: webSocket(url, { reconnect: { attempts: 20, delay: 2_000 }, keepAlive: { interval: 25_000 } }) }),
    }
  }
  return cachedWs.client
}

export function reader(signal?: AbortSignal) {
  const client = signal ? createPublicClient({ chain: tiramisu, transport: politeHttp(settings.get().rpcUrl, { signal, maxWaitMs: 20_000 }) }) : publicClient()
  return createArchiveReader(client as unknown as ArchiveClient)
}

export class EndpointError extends Error {}

/** Check an endpoint answers JSON-RPC and is the Tiramisu chain. */
export async function checkEndpoint(url: string, signal?: AbortSignal): Promise<{ chainId: number; block: bigint }> {
  let res: Response
  try {
    res = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
        { jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] },
      ]),
    })
  } catch {
    throw new EndpointError("The endpoint could not be reached (network error or blocked by CORS).")
  }
  if (!res.ok) throw new EndpointError(`The endpoint answered HTTP ${res.status}.`)
  const body = (await res.json()) as { id: number; result?: string }[]
  const chain = body.find((r) => r.id === 1)?.result
  const block = body.find((r) => r.id === 2)?.result
  if (!chain || !block) throw new EndpointError("The endpoint did not return a chain id and block number.")
  const chainId = Number.parseInt(chain, 16)
  if (chainId !== TIRAMISU.chainId) throw new EndpointError(`This endpoint serves chain ${chainId}, not Tiramisu (${TIRAMISU.chainId}).`)
  return { chainId, block: BigInt(block) }
}

/** Collect messages along an error's cause chain (viem wraps transport errors several levels deep). */
function chainText(err: unknown): string {
  const parts: string[] = []
  let e: unknown = err
  for (let i = 0; e && i < 8; i++) {
    const x = e as { shortMessage?: string; message?: string; details?: string; status?: number; cause?: unknown }
    parts.push(String(x.status ?? ""), x.shortMessage ?? "", x.message ?? "", x.details ?? "")
    e = x.cause
  }
  return parts.join(" ")
}

/** Human message for a failed read, distinguishing rate limits from other failures. */
export function readErrorMessage(err: unknown): string {
  const text = chainText(err)
  if (/429|rate limit|too many/i.test(text)) {
    const s = /about (\d+) s/.exec(text)?.[1]
    return `The public Arkiv endpoint is rate limiting this connection${s ? ` for about ${s} seconds` : ""}. Nothing failed on chain; try again shortly, or use your own endpoint in Settings.`
  }
  if (/fetch|network|timeout|timed out|Failed to fetch/i.test(text)) return "Arkiv could not be reached from this browser. Check your connection or the endpoint in Settings."
  const first = (err as { shortMessage?: string; message?: string })?.shortMessage ?? (err as Error)?.message ?? String(err)
  return `Arkiv returned an error: ${first.slice(0, 180)}`
}
