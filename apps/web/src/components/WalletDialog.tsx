import { TIRAMISU, formatGlm } from "muniment-query"
import { useEffect, useState } from "react"
import { useWallet } from "../lib/wallet"
import { Address, Dialog, ExternalLink, Notice } from "./ui"

export function WalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const w = useWallet()
  const [bal, setBal] = useState<bigint | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (!open || w.status !== "connected" || !w.onTiramisu) {
      setBal(null)
      return
    }
    let alive = true
    w.balance()
      .then((b) => alive && setBal(b))
      .catch(() => alive && setBal(null))
    return () => {
      alive = false
    }
  }, [open, w.status, w.onTiramisu, w.address, w.balance])

  return (
    <Dialog open={open} onClose={onClose} title="Wallet">
      <p className="muted">
        A wallet is only needed to sign: publishing a synthetic record, renewing records, or writing a review. Searching and reading never ask
        for one.
      </p>
      {w.error ? <Notice tone="warn">{w.error}</Notice> : null}
      {w.status === "unavailable" ? (
        <Notice tone="info" title="No browser wallet detected">
          Install an EVM wallet extension (for example MetaMask or Rabby) to sign on Tiramisu. Test GLM for fees comes from the{" "}
          <ExternalLink href={TIRAMISU.faucet}>Arkiv faucet</ExternalLink>.
        </Notice>
      ) : null}
      {w.status === "disconnected" || w.status === "connecting" ? (
        <div className="stack-sm">
          <p className="label" style={{ fontWeight: 600 }}>
            Choose a wallet
          </p>
          <div className="cluster">
            {w.wallets.map((x) => (
              <button key={x.id} type="button" className="btn" onClick={() => w.connect(x.id)} disabled={w.status === "connecting"}>
                {x.icon ? <img src={x.icon} alt="" width={20} height={20} /> : null}
                {x.name}
              </button>
            ))}
          </div>
          {w.status === "connecting" ? <p className="faint">Waiting for your wallet to share an account…</p> : null}
        </div>
      ) : null}
      {w.status === "connected" ? (
        <div className="stack">
          <dl className="kv">
            <dt>Wallet</dt>
            <dd>{w.walletName}</dd>
            <dt>Account</dt>
            <dd>
              <Address value={w.address} />
            </dd>
            <dt>Network</dt>
            <dd>{w.onTiramisu ? `${TIRAMISU.name} (chain ${TIRAMISU.chainId})` : `Chain ${w.chainId ?? "unknown"} — not Tiramisu`}</dd>
            {w.onTiramisu ? (
              <>
                <dt>Balance</dt>
                <dd>{bal === null ? "Reading…" : `${formatGlm(bal)} test GLM`}</dd>
              </>
            ) : null}
          </dl>
          {!w.onTiramisu ? (
            <div className="stack-sm">
              <Notice tone="warn" title="Switch to Tiramisu to sign">
                Muniment only writes to the Arkiv Tiramisu testnet. Your wallet will ask to add or switch the network.
              </Notice>
              {switchError ? <Notice tone="danger">{switchError}</Notice> : null}
              <button
                type="button"
                className="btn btn-primary"
                disabled={switching}
                onClick={async () => {
                  setSwitching(true)
                  setSwitchError(null)
                  try {
                    await w.switchNetwork()
                  } catch (e) {
                    setSwitchError((e as Error).message)
                  } finally {
                    setSwitching(false)
                  }
                }}
              >
                {switching ? "Waiting for your wallet…" : "Switch to Tiramisu"}
              </button>
            </div>
          ) : bal === 0n ? (
            <Notice tone="info" title="This wallet has no test GLM">
              Claim some from the <ExternalLink href={TIRAMISU.faucet}>Arkiv faucet</ExternalLink> before signing. Test GLM has no monetary value.
            </Notice>
          ) : null}
          <div className="cluster">
            <button type="button" className="btn btn-sm" onClick={w.forget}>
              Forget this connection
            </button>
          </div>
          <p className="faint" style={{ fontSize: "0.82rem" }}>
            "Forget" stops Muniment from reconnecting automatically. To fully revoke access, remove this site in your wallet's connected-sites
            settings.
          </p>
        </div>
      ) : null}
    </Dialog>
  )
}
