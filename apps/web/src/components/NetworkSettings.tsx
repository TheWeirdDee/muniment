import { TIRAMISU } from "muniment-query"
import { useEffect, useRef, useState } from "react"
import { checkEndpoint } from "../lib/arkiv"
import { formatBlock } from "../lib/format"
import { DEFAULT_SETTINGS, settings } from "../lib/settings"
import { Dialog, Icon, Notice } from "./ui"

export function NetworkSettings({ compact = false }: { compact?: boolean }) {
  const s = settings.use()
  const [open, setOpen] = useState(false)
  const [rpc, setRpc] = useState(s.rpcUrl)
  const [ws, setWs] = useState(s.wsUrl)
  const [state, setState] = useState<{ kind: "idle" } | { kind: "checking" } | { kind: "ok"; block: bigint } | { kind: "error"; msg: string }>({ kind: "idle" })
  const custom = s.rpcUrl !== DEFAULT_SETTINGS.rpcUrl
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [open])

  const save = async () => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setState({ kind: "checking" })
    try {
      if (!rpc.startsWith("https://")) throw new Error("The HTTP endpoint must use https://")
      if (!ws.startsWith("wss://")) throw new Error("The WebSocket endpoint must use wss://")
      const r = await checkEndpoint(rpc, controller.signal)
      controller.signal.throwIfAborted()
      settings.set((prev) => ({ ...prev, rpcUrl: rpc, wsUrl: ws }))
      setState({ kind: "ok", block: r.block })
    } catch (e) {
      if (controller.signal.aborted) return
      setState({ kind: "error", msg: (e as Error).message })
    }
  }

  return (
    <>
      <button
        type="button"
        className={compact ? "icon-btn" : "btn btn-sm"}
        onClick={() => {
          setRpc(s.rpcUrl)
          setWs(s.wsUrl)
          setState({ kind: "idle" })
          setOpen(true)
        }}
        aria-label="Network settings"
        title={custom ? "Network settings (custom endpoint)" : "Network settings"}
      >
        <Icon name="settings" />
        {compact ? null : <span>Network</span>}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Network settings"
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                settings.set((p) => ({ ...p, rpcUrl: DEFAULT_SETTINGS.rpcUrl, wsUrl: DEFAULT_SETTINGS.wsUrl }))
                setRpc(DEFAULT_SETTINGS.rpcUrl)
                setWs(DEFAULT_SETTINGS.wsUrl)
                setState({ kind: "idle" })
              }}
            >
              Reset to public endpoint
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={state.kind === "checking"}>
              {state.kind === "checking" ? "Checking…" : "Check and save"}
            </button>
          </>
        }
      >
        <p className="muted">
          Muniment reads directly from an Arkiv RPC endpoint in your browser. The default is the public Tiramisu endpoint, which is rate limited.
          Any endpoint you enter here is checked for the Tiramisu chain id ({TIRAMISU.chainId}) before use. Never paste an endpoint that embeds a
          private access key you don't want this browser to send.
        </p>
        <div className="field">
          <label htmlFor="rpc-url">HTTP endpoint</label>
          <input id="rpc-url" className="input mono" value={rpc} onChange={(e) => setRpc(e.target.value)} spellCheck={false} autoComplete="off" inputMode="url" />
        </div>
        <div className="field">
          <label htmlFor="ws-url">WebSocket endpoint (live updates)</label>
          <input id="ws-url" className="input mono" value={ws} onChange={(e) => setWs(e.target.value)} spellCheck={false} autoComplete="off" inputMode="url" />
        </div>
        <label className="check">
          <input type="checkbox" checked={s.anyPublisher} onChange={(e) => settings.set((p) => ({ ...p, anyPublisher: e.target.checked }))} />
          <span>
            Show records from any wallet that uses Muniment's namespace
            <span className="faint" style={{ display: "block", fontSize: "0.85rem" }}>
              Off by default: the archive lists only records whose on-chain creator is a publisher this deployment trusts. Anyone can copy the
              namespace, so untrusted records are labelled.
            </span>
          </span>
        </label>
        {state.kind === "ok" ? <Notice tone="ok">Connected to Tiramisu. Head block {formatBlock(state.block)}. Saved.</Notice> : null}
        {state.kind === "error" ? <Notice tone="danger">{state.msg}</Notice> : null}
      </Dialog>
    </>
  )
}
