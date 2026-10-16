import { TIRAMISU } from "muniment-query"
import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import { DASHBOARD_URL, REPO_URL } from "../lib/config"
import { shortHex } from "../lib/format"
import { setTheme, useTheme, type ThemeChoice } from "../lib/theme"
import { useWallet } from "../lib/wallet"
import { NetworkSettings } from "./NetworkSettings"
import { Arrow, Dialog, ExternalLink, hasOpenDialog, Icon, LogoMark } from "./ui"
import { WalletDialog } from "./WalletDialog"

/** Primary destinations for a first-time reader. */
export const PRIMARY_NAV = [
  { to: "/archive", label: "Archive" },
  { to: "/collections", label: "Collections" },
  { to: "/how-it-works", label: "How it works" },
]

/** Task and technical destinations, reachable from the More menu, the footer and in-page actions. */
export const MORE_NAV = [
  { to: "/preserve", label: "Preserve queue", note: "Records nearing expiry" },
  { to: "/publish", label: "Publish", note: "Try a synthetic record" },
  { to: "/insights", label: "Insights", note: "Counts and the dashboard" },
  { to: "/developers", label: "Developers", note: "Data contract and queries" },
]

function ThemeChoices() {
  const theme = useTheme()
  const opts: { v: ThemeChoice; label: string }[] = [
    { v: "dark", label: "Dark" },
    { v: "light", label: "Light" },
    { v: "system", label: "Match system" },
  ]
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ marginBottom: "0.4rem" }}>
        Theme
      </legend>
      <div className="segmented" role="radiogroup" aria-label="Theme">
        {opts.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={theme === o.v} onClick={() => setTheme(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** One settings control: theme, network endpoint and, only when wanted, the wallet. */
export function SettingsButton() {
  const [open, setOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const w = useWallet()
  const walletText = w.status === "connected" ? (w.onTiramisu ? shortHex(w.address) : "connected, wrong network") : "not connected"
  return (
    <>
      <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="Settings" title="Settings" aria-haspopup="dialog">
        <Icon name="settings" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Settings">
        <ThemeChoices />
        <div className="stack-sm">
          <p className="label" style={{ fontWeight: 600 }}>
            Arkiv endpoint
          </p>
          <p className="faint" style={{ fontSize: "0.88rem" }}>
            Where your browser reads records from. The default is the public Tiramisu endpoint.
          </p>
          <NetworkSettings />
        </div>
        <div className="stack-sm">
          <p className="label" style={{ fontWeight: 600 }}>
            Wallet: {walletText}
          </p>
          <p className="faint" style={{ fontSize: "0.88rem" }}>
            Only needed to renew storage, publish or review. Pages that sign will ask when the time comes.
          </p>
          <button
            type="button"
            className="btn btn-sm"
            style={{ width: "fit-content" }}
            onClick={() => {
              setOpen(false)
              setWalletOpen(true)
            }}
          >
            <Icon name="wallet" />
            {w.status === "connected" ? "Manage wallet" : "Connect a wallet"}
          </button>
        </div>
      </Dialog>
      <WalletDialog open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  )
}

function MoreMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus()
      }
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])
  const active = MORE_NAV.some((n) => loc.pathname.startsWith(n.to))
  return (
    <div className="more" ref={ref}>
      <button type="button" className={`more-toggle ${active ? "is-active" : ""}`} aria-expanded={open} aria-controls="more-menu" onClick={() => setOpen((o) => !o)}>
        More <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <ul id="more-menu" className="more-menu">
          {MORE_NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to}>
                <span>{n.label}</span>
                <span className="faint">{n.note}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <a href="/reader.html">
              <span>Standalone reader</span>
              <span className="faint">Read without this site</span>
            </a>
          </li>
        </ul>
      ) : null}
    </div>
  )
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>("a, button")?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (hasOpenDialog()) return
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Site menu" ref={ref}>
      <div className="mobile-menu-top">
        <Link to="/" className="brand" onClick={onClose}>
          <LogoMark />
          Muniment
        </Link>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close menu">
          <Icon name="close" />
        </button>
      </div>
      <nav aria-label="Mobile">
        <ul>
          {PRIMARY_NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} onClick={onClose}>
                {n.label}
                <Arrow />
              </NavLink>
            </li>
          ))}
        </ul>
        <ul className="mobile-secondary">
          {MORE_NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} onClick={onClose}>
                {n.label}
                <Arrow />
              </NavLink>
            </li>
          ))}
          <li>
            <a href="/reader.html" onClick={onClose}>
              Standalone reader
              <Arrow dir="ne" />
            </a>
          </li>
        </ul>
      </nav>
      <div className="mobile-menu-foot">
        <div className="cluster">
          <SettingsButton />
          <span className="faint">Settings: theme, endpoint, wallet</span>
        </div>
        <p className="faint" style={{ fontSize: "0.85rem" }}>
          Testnet demo with synthetic records. Browsing never needs a wallet.
        </p>
      </div>
    </div>
  )
}

function Header() {
  const [menu, setMenu] = useState(false)
  const loc = useLocation()
  useEffect(() => setMenu(false), [loc.pathname])
  return (
    <header className="site-header">
      <div className="wrap">
        <Link to="/" className="brand" aria-label="Muniment home">
          <LogoMark />
          Muniment
        </Link>
        <nav aria-label="Primary" className="desktop-nav">
          <ul className="nav-links">
            {PRIMARY_NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to}>{n.label}</NavLink>
              </li>
            ))}
            <li>
              <MoreMenu />
            </li>
          </ul>
        </nav>
        <div className="header-actions">
          <span className="desktop-only">
            <SettingsButton />
          </span>
          <Link to="/archive" className="btn btn-sm desktop-only">
            Explore the archive
          </Link>
          <button type="button" className="icon-btn menu-toggle" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>
            <Icon name="menu" />
          </button>
        </div>
      </div>
      {menu ? <MobileMenu onClose={() => setMenu(false)} /> : null}
    </header>
  )
}

function ScopeBar() {
  return (
    <div className="scope-bar">
      <div className="wrap">
        <span>
          <span className="scope-dot" aria-hidden="true" />
          Testnet demo · Synthetic government replies
        </span>
        <Link to="/how-it-works#limits">What that means</Link>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <div className="stack-sm">
            <p style={{ maxWidth: "34ch", color: "var(--ink-2)" }}>
              Muniment keeps public answers findable and renewable on Arkiv, so they don't depend on one website or one uploader.
            </p>
            <p className="faint" style={{ fontSize: "0.85rem" }}>
              Built for the Arkiv Global Tour Stop, October 2026. Open source under the MIT licence.
            </p>
          </div>
          <div>
            <h2>Archive</h2>
            <ul>
              <li>
                <Link to="/archive">Search replies</Link>
              </li>
              <li>
                <Link to="/preserve">Preserve queue</Link>
              </li>
              <li>
                <Link to="/collections">Your collections</Link>
              </li>
              <li>
                <Link to="/publish">Publish a synthetic record</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Read independently</h2>
            <ul>
              <li>
                <a href="/reader.html">Standalone reader</a>
              </li>
              <li>
                <ExternalLink href={DASHBOARD_URL}>Response-time dashboard</ExternalLink>
              </li>
              <li>
                <Link to="/developers">Data contract &amp; queries</Link>
              </li>
              <li>
                <ExternalLink href={TIRAMISU.explorer}>Tiramisu explorer</ExternalLink>
              </li>
            </ul>
          </div>
          <div>
            <h2>Project</h2>
            <ul>
              <li>
                <Link to="/how-it-works">How it works</Link>
              </li>
              <li>
                <ExternalLink href={REPO_URL}>Source code</ExternalLink>
              </li>
              <li>
                <ExternalLink href={`${REPO_URL}/blob/main/arkiv/friction.md`}>Friction report</ExternalLink>
              </li>
              <li>
                <ExternalLink href={`${REPO_URL}/blob/main/docs/testing.md`}>Evidence &amp; testing</ExternalLink>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          Muniment
        </div>
        <div className="footer-legal">
          <div className="cluster">
            <span className="scope-badge">Testnet · synthetic data</span>
            <span>© 2026 Muniment contributors · MIT licence</span>
          </div>
          <ul>
            <li>
              <Link to="/privacy">Privacy</Link>
            </li>
            <li>
              <Link to="/terms">Terms</Link>
            </li>
            <li>
              <ExternalLink href={`${REPO_URL}/issues`}>Report a problem</ExternalLink>
            </li>
            <li>
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault()
                  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
                  document.getElementById("main")?.focus()
                }}
              >
                Back to top ↑
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}

export function Layout() {
  const loc = useLocation()
  useEffect(() => {
    if (loc.hash) {
      const el = document.getElementById(decodeURIComponent(loc.hash.slice(1)))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [loc.pathname, loc.hash])
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <span id="top" />
      <ScopeBar />
      <Header />
      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
