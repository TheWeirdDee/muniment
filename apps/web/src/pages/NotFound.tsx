import { Link, useLocation } from "react-router"
import { Arrow } from "../components/ui"
import { usePageMeta } from "../lib/meta"

export default function NotFound() {
  const loc = useLocation()
  usePageMeta("Page not found", "This address does not match a Muniment page.", { noindex: true })
  return (
    <section className="wrap" style={{ paddingBlock: "var(--space-9)" }}>
      <span className="eyebrow">404</span>
      <h1 className="display" style={{ fontSize: "var(--step-5)", margin: "1rem 0" }}>
        Not here.
      </h1>
      <p className="muted measure" style={{ fontSize: "1.1rem" }}>
        <span className="mono">{loc.pathname.slice(0, 80)}</span> isn't a page on this site. If you followed a link to a record, it should start with
        /records/ and end in a 64-character key.
      </p>
      <div className="cluster" style={{ marginTop: "var(--space-5)" }}>
        <Link to="/archive" className="btn btn-primary">
          Search the archive <Arrow />
        </Link>
        <Link to="/" className="link-arrow plain">
          Home <Arrow />
        </Link>
      </div>
    </section>
  )
}
