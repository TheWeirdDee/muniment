/**
 * An injected EIP-1193 test wallet for Playwright. The private key stays in this Node process; the
 * page only sees an announced provider whose requests are forwarded here. Transactions are real:
 * they are signed locally and broadcast to Tiramisu. This replaces a human clicking "approve" in a
 * wallet extension, nothing else.
 */
import type { Page } from "@playwright/test"
import { http, createWalletClient, publicActions } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { tiramisu } from "@arkiv-network/sdk/chains"

export type TestWalletOptions = { key: `0x${string}`; reject?: boolean; chainIdHex?: string }

export async function injectTestWallet(page: Page, opts: TestWalletOptions) {
  const account = privateKeyToAccount(opts.key)
  const client = createWalletClient({ account, chain: tiramisu, transport: http() }).extend(publicActions)
  let chainHex = opts.chainIdHex ?? "0x7614d1"
  const sent: string[] = []
  await page.exposeFunction("__mmTestWallet", async (method: string, params: unknown[]) => {
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts":
        return [account.address]
      case "eth_chainId":
        return chainHex
      case "wallet_switchEthereumChain":
      case "wallet_addEthereumChain":
        chainHex = "0x7614d1"
        return null
      case "eth_sendTransaction": {
        if (opts.reject) throw Object.assign(new Error("User rejected the request."), { code: 4001 })
        const tx = (params as { to: `0x${string}`; data: `0x${string}`; gas?: string }[])[0]
        const hash = await client.sendTransaction({ to: tx.to, data: tx.data, gas: tx.gas ? BigInt(tx.gas) : undefined })
        sent.push(hash)
        return hash
      }
      default:
        return client.request({ method: method as never, params: params as never })
    }
  })
  // Passed as a string: transpilers (tsx/esbuild keepNames) inject helpers into serialised functions.
  await page.addInitScript(`(() => {
    const call = window.__mmTestWallet
    const listeners = {}
    const provider = {
      async request({ method, params }) {
        try {
          return await call(method, params || [])
        } catch (e) {
          const out = new Error((e && e.message) || String(e))
          if (/rejected/i.test(out.message)) out.code = 4001
          throw out
        }
      },
      on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn) },
      removeListener(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn) },
    }
    const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info: { uuid: "playwright-test-wallet", name: "Playwright test wallet", icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E", rdns: "dev.muniment.testwallet" }, provider }),
    }))
    window.addEventListener("eip6963:requestProvider", announce)
    announce()
  })()`)
  return { address: account.address, sent }
}
