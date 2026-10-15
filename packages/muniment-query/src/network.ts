/**
 * Network facts Muniment depends on. Values were checked against the live Tiramisu node and the
 * official hackathon README on 15 October 2026; see arkiv/friction.md for the probe record.
 */

export const TIRAMISU = {
  chainId: 7738577,
  chainIdHex: "0x7614d1",
  name: "Arkiv Tiramisu testnet",
  httpRpc: "https://rpc.tiramisu.db-chain.testnet.arkiv.network",
  wsRpc: "wss://rpc.tiramisu.db-chain.testnet.arkiv.network",
  explorer: "https://tiramisu.explorer.arkiv.network",
  faucet: "https://hub.arkiv.network/faucet",
  nativeSymbol: "GLM",
  nativeDecimals: 18,
} as const

/** The protocol precompile every Arkiv write is sent to. Same on every Arkiv chain. */
export const ARKIV_ADDRESS = "0x4400000000000000000000000000000000000044" as const

/** Nominal block time. Block production is not a clock, so every conversion is approximate. */
export const BLOCK_SECONDS = 2

export const BLOCKS_PER_DAY = (24 * 60 * 60) / BLOCK_SECONDS

/** Node page-size ceiling for arkiv_query (documented and observed). */
export const MAX_PAGE_SIZE = 200

/** An address nobody holds a key for. Records "sealed" to it can no longer be deleted or transferred. */
export const SEAL_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const

export function explorerTx(hash: string): string {
  return `${TIRAMISU.explorer}/tx/${hash}`
}

export function explorerAddress(address: string): string {
  return `${TIRAMISU.explorer}/address/${address}`
}

export function explorerEntity(key: string): string {
  return `${TIRAMISU.explorer}/entity/${key}`
}

export function daysToBlocks(days: number): bigint {
  return BigInt(Math.round(days * BLOCKS_PER_DAY))
}

/**
 * Approximate wall-clock time for a future (or past) block, anchored to an observed head block and
 * its timestamp. Always present the result as an estimate.
 */
export function estimateBlockTime(
  block: bigint,
  anchor: { block: bigint; timeMs: number },
): number {
  const delta = Number(block - anchor.block) * BLOCK_SECONDS * 1000
  return anchor.timeMs + delta
}
