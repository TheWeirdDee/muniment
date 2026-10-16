import { explorerAddress, type Hex } from "muniment-query"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { shortHex, walletLabel } from "../lib/format"

export function LogoMark({ size = 26, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path d="M5 2.5h15.5L27 9v20.5H5z" fill="currentColor" />
      <path d="M20.5 2.5V9H27z" fill="#576238" />
      <rect x="9" y="13" width="11" height="2.4" fill="var(--bg, #111114)" />
      <rect x="9" y="18" width="7.5" height="2.4" fill="var(--bg, #111114)" />
      <path d="M20.5 16.5h5.5v14l-2.75-2.3-2.75 2.3z" fill="#ffd95d" stroke="var(--bg, #111114)" strokeWidth="1.2" />
    </svg>
  )
}

export function Arrow({ dir = "right" }: { dir?: "right" | "ne" | "down" | "left" }) {
  const d = { right: "M3 8h10M9 4l4 4-4 4", ne: "M4 12L12 4M6 4h6v6", down: "M8 3v10M4 9l4 4 4-4", left: "M13 8H3M7 4L3 8l4 4" }[dir]
  return (
    <svg className={`arrow ${dir === "ne" ? "arrow-ne" : ""}`} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
      <path d={d} />
    </svg>
  )
}

export function Icon({ name }: { name: "menu" | "close" | "sun" | "moon" | "system" | "copy" | "check" | "wallet" | "settings" | "external" }) {
  const paths: Record<string, ReactNode> = {
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    close: <path d="M5 5l14 14M19 5L5 19" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
    system: (
      <>
        <rect x="3" y="4" width="18" height="12" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" />
        <path d="M16 8V4H4v12h4" />
      </>
    ),
    check: <path d="M4 12l5 5L20 6" />,
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="13" />
        <path d="M16 12.5h2M3 9h15V6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </>
    ),
    external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  )
}

/** A wallet address with its known role, a full value for copying and an explorer link. */
export function Address({ value, label = true }: { value: string | null | undefined; label?: boolean }) {
  if (!value) return <span className="faint">unknown</span>
  const role = label ? walletLabel(value) : null
  return (
    <span className="address">
      <ExternalLink href={explorerAddress(value)} className="hash">
        <span aria-hidden="true">{shortHex(value)}</span>
        <span className="visually-hidden">{value}</span>
      </ExternalLink>
      {role ? <span className="faint"> · {role}</span> : null}
    </span>
  )
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState<"idle" | "ok" | "fail">("idle")
  useEffect(() => {
    if (done === "idle") return
    const t = window.setTimeout(() => setDone("idle"), 1800)
    return () => window.clearTimeout(t)
  }, [done])
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone("ok")
        } catch {
          setDone("fail")
        }
      }}
    >
      <Icon name={done === "ok" ? "check" : "copy"} />
      <span aria-live="polite">{done === "ok" ? "Copied" : done === "fail" ? "Copy blocked" : label}</span>
    </button>
  )
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack-sm" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? "1.6rem" : "1rem", width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  )
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "danger" | "ok"; title?: string; children?: ReactNode }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "danger" ? "alert" : undefined}>
      {title ? <strong>{title}</strong> : null}
      {children ? <div className="muted">{children}</div> : null}
    </div>
  )
}

/** Open dialogs, topmost last: only the topmost one reacts to Escape and traps focus. */
const dialogStack: string[] = []

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /** False while a wallet request is pending, so Escape cannot orphan it. */
  dismissible?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const restore = useRef<HTMLElement | null>(null)
  const lifecycle = useRef({ onClose, dismissible })
  lifecycle.current = { onClose, dismissible }
  useEffect(() => {
    if (!open) return
    dialogStack.push(id)
    restore.current = document.activeElement as HTMLElement | null
    const el = ref.current
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("button, [href], input, select, textarea")
    first?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== id) return
      if (e.key === "Escape" && lifecycle.current.dismissible) {
        e.stopPropagation()
        lifecycle.current.onClose()
      }
      if (e.key === "Tab" && el) {
        const items = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
        if (items.length === 0) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      const at = dialogStack.lastIndexOf(id)
      if (at >= 0) dialogStack.splice(at, 1)
      document.body.style.overflow = dialogStack.length ? "hidden" : prevOverflow
      restore.current?.focus?.()
    }
  }, [open, id])
  if (!open) return null
  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose()
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} ref={ref}>
        <div className="dialog-head">
          <h2 id={`${id}-t`} style={{ fontSize: "var(--step-2)" }}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} disabled={!dismissible} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export function SyntheticPill() {
  return <span className="pill pill-synthetic no-dot">Synthetic test record</span>
}

export function KeyText({ value }: { value: Hex | string }) {
  return (
    <span className="hash" title={value}>
      {value}
    </span>
  )
}
