/**
 * Wallet connection for signing actions only. Reading never needs a wallet. Connection, account
 * selection, network selection and transaction approval are separate steps with separate states.
 * Wallets are discovered with EIP-6963, falling back to window.ethereum.
 */
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { TIRAMISU, type Hex } from "muniment-query"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { custom } from "viem"
import { readStorage, writeStorage } from "./store"

type Eip1193 = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>
  on?(event: string, fn: (...args: never[]) => void): void
  removeListener?(event: string, fn: (...args: never[]) => void): void
}

export type DiscoveredWallet = { id: string; name: string; icon: string | null; provider: Eip1193 }

export type WalletStatus = "unavailable" | "disconnected" | "connecting" | "connected"

export type WalletState = {
  status: WalletStatus
  wallets: DiscoveredWallet[]
  address: Hex | null
  chainId: number | null
  walletName: string | null
  error: string | null
}

type WalletApi = WalletState & {
  onTiramisu: boolean
  connect(id?: string): Promise<void>
  forget(): void
  switchNetwork(): Promise<void>
  /** SDK wallet client bound to the connected wallet. onSubmitted receives the hash at broadcast. */
  signer(onSubmitted?: (hash: Hex) => void): ReturnType<typeof createWalletClient>
  balance(): Promise<bigint>
}

const Ctx = createContext<WalletApi | null>(null)
const REMEMBER = "muniment.wallet.v1"

export function describeWalletError(err: unknown): string {
  // Arkiv and viem wrap provider errors several levels deep. Preserve the wallet's rejection code.
  const codes: number[] = []
  const messages: string[] = []
  let current = err
  for (let depth = 0; current && depth < 10; depth++) {
    const e = current as { code?: number; shortMessage?: string; message?: string; cause?: unknown }
    if (typeof e.code === "number") codes.push(e.code)
    messages.push(e.shortMessage ?? "", e.message ?? "")
    current = e.cause
  }
  const code = codes.includes(4001) ? 4001 : codes[0]
  const text = messages.join(" ")
  if (code === 4001 || /user rejected|user denied|rejected the request/i.test(text)) return "You declined the request in your wallet. Nothing was sent."
  if (code === -32002) return "Your wallet already has a pending request. Open the wallet to continue."
  if (/insufficient funds/i.test(text)) return "This wallet does not hold enough test GLM to pay for the transaction."
  if (code === 4902 || /unrecognized chain|unknown chain/i.test(text)) return "Your wallet does not know the Tiramisu network yet."
  if (/NotOwner/.test(text)) return "Arkiv rejected the write: this wallet does not own the entity and the entity does not allow permissionless extension."
  if (/ExpiryNotExtended/.test(text)) return "Arkiv rejected the extension: the new expiry is not later than the current one. Refresh the quote."
  if (/EntityNotFound|EntityExpired/.test(text)) return "Arkiv rejected the write: the entity no longer exists or has expired."
  if (/reverted/i.test(text)) return `The transaction reverted on chain. ${text.trim().slice(0, 200)}`
  return text.trim().slice(0, 240) || "The wallet request failed."
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([])
  const [state, setState] = useState<Omit<WalletState, "wallets">>({ status: "disconnected", address: null, chainId: null, walletName: null, error: null })
  const active = useRef<DiscoveredWallet | null>(null)
  const discoveryDone = useRef(false)

  // EIP-6963 discovery
  useEffect(() => {
    const found = new Map<string, DiscoveredWallet>()
    const onAnnounce = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193 }
      if (!d?.info || !d.provider) return
      found.set(d.info.uuid, { id: d.info.rdns || d.info.uuid, name: d.info.name, icon: /^data:image\//.test(d.info.icon) ? d.info.icon : null, provider: d.provider })
      setWallets([...found.values()])
    }
    window.addEventListener("eip6963:announceProvider", onAnnounce)
    window.dispatchEvent(new Event("eip6963:requestProvider"))
    const t = window.setTimeout(() => {
      discoveryDone.current = true
      const legacy = (window as unknown as { ethereum?: Eip1193 }).ethereum
      if (found.size === 0 && legacy) {
        found.set("injected", { id: "injected", name: "Browser wallet", icon: null, provider: legacy })
        setWallets([...found.values()])
      }
      if (found.size === 0) setState((s) => (s.status === "disconnected" ? { ...s, status: "unavailable" } : s))
    }, 450)
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce)
      window.clearTimeout(t)
    }
  }, [])

  const bind = useCallback((w: DiscoveredWallet) => {
    const prev = active.current
    if (prev?.provider.removeListener) {
      prev.provider.removeListener("accountsChanged", onAccounts as never)
      prev.provider.removeListener("chainChanged", onChain as never)
    }
    active.current = w
    w.provider.on?.("accountsChanged", onAccounts as never)
    w.provider.on?.("chainChanged", onChain as never)
    function onAccounts(accounts: string[]) {
      if (!accounts || accounts.length === 0) {
        setState({ status: "disconnected", address: null, chainId: null, walletName: null, error: "The wallet disconnected this site." })
        writeStorage(REMEMBER, null)
      } else {
        setState((s) => ({ ...s, address: accounts[0] as Hex }))
      }
    }
    function onChain(hex: string) {
      setState((s) => ({ ...s, chainId: Number.parseInt(hex, 16) }))
    }
  }, [])

  // Restore a remembered connection silently (eth_accounts never prompts).
  useEffect(() => {
    const remembered = readStorage(REMEMBER)
    if (!remembered || wallets.length === 0 || active.current) return
    const w = wallets.find((x) => x.id === remembered) ?? (remembered === "injected" ? wallets[0] : undefined)
    if (!w) return
    ;(async () => {
      try {
        const accounts = (await w.provider.request({ method: "eth_accounts" })) as string[]
        if (!accounts?.length) return
        const chain = (await w.provider.request({ method: "eth_chainId" })) as string
        bind(w)
        setState({ status: "connected", address: accounts[0] as Hex, chainId: Number.parseInt(chain, 16), walletName: w.name, error: null })
      } catch {
        // silent restore is best effort
      }
    })()
  }, [wallets, bind])

  const connect = useCallback(
    async (id?: string) => {
      const w = (id ? wallets.find((x) => x.id === id) : wallets[0]) ?? null
      if (!w) {
        setState((s) => ({ ...s, status: "unavailable", error: "No browser wallet was found. Install an EVM wallet extension to sign; reading needs no wallet." }))
        return
      }
      setState((s) => ({ ...s, status: "connecting", error: null }))
      try {
        const accounts = (await w.provider.request({ method: "eth_requestAccounts" })) as string[]
        if (!accounts?.length) throw new Error("The wallet returned no account.")
        const chain = (await w.provider.request({ method: "eth_chainId" })) as string
        bind(w)
        writeStorage(REMEMBER, w.id)
        setState({ status: "connected", address: accounts[0] as Hex, chainId: Number.parseInt(chain, 16), walletName: w.name, error: null })
      } catch (err) {
        setState({ status: "disconnected", address: null, chainId: null, walletName: null, error: describeWalletError(err) })
      }
    },
    [wallets, bind],
  )

  const forget = useCallback(() => {
    writeStorage(REMEMBER, null)
    active.current = null
    setState({ status: wallets.length ? "disconnected" : "unavailable", address: null, chainId: null, walletName: null, error: null })
  }, [wallets.length])

  const switchNetwork = useCallback(async () => {
    const w = active.current
    if (!w) throw new Error("Connect a wallet first.")
    try {
      await w.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: TIRAMISU.chainIdHex }] })
    } catch (err) {
      const code = (err as { code?: number }).code ?? (err as { data?: { originalError?: { code?: number } } }).data?.originalError?.code
      if (code !== 4902 && !/unrecognized|unknown chain|not added/i.test(String((err as Error).message))) throw new Error(describeWalletError(err))
      await w.provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: TIRAMISU.chainIdHex,
            chainName: "Arkiv Tiramisu (testnet)",
            nativeCurrency: { name: "Golem (test)", symbol: "GLM", decimals: 18 },
            rpcUrls: [TIRAMISU.httpRpc],
            blockExplorerUrls: [TIRAMISU.explorer],
          },
        ],
      })
    }
    const chain = (await w.provider.request({ method: "eth_chainId" })) as string
    setState((s) => ({ ...s, chainId: Number.parseInt(chain, 16) }))
  }, [])

  const signer = useCallback(
    (onSubmitted?: (hash: Hex) => void) => {
      const w = active.current
      if (!w || !state.address) throw new Error("Connect a wallet first.")
      const transport = custom({
        async request(args: { method: string; params?: unknown }) {
          const result = await w.provider.request(args as never)
          if (args.method === "eth_sendTransaction" && typeof result === "string") onSubmitted?.(result as Hex)
          return result
        },
      })
      return createWalletClient({ chain: tiramisu, transport, account: state.address })
    },
    [state.address],
  )

  const balance = useCallback(async () => {
    const w = active.current
    if (!w || !state.address) return 0n
    const hex = (await w.provider.request({ method: "eth_getBalance", params: [state.address, "latest"] })) as string
    return BigInt(hex)
  }, [state.address])

  const api = useMemo<WalletApi>(
    () => ({ ...state, wallets, onTiramisu: state.chainId === TIRAMISU.chainId, connect, forget, switchNetwork, signer, balance }),
    [state, wallets, connect, forget, switchNetwork, signer, balance],
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useWallet(): WalletApi {
  const v = useContext(Ctx)
  if (!v) throw new Error("useWallet outside WalletProvider")
  return v
}
