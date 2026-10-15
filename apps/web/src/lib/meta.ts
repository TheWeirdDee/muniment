import { useEffect } from "react"
import { SITE_URL } from "./config"

/**
 * Per-route document metadata for in-app navigation. Crawlers get the same values from the
 * prerendered HTML generated at build time (scripts/prerender.mjs), so share previews do not depend
 * on JavaScript.
 */
export function usePageMeta(title: string, description: string, opts: { path?: string; noindex?: boolean } = {}) {
  useEffect(() => {
    const full = title === "Muniment" ? "Muniment — keep public answers available" : `${title} · Muniment`
    document.title = full
    const set = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector(selector)
      if (el) el.setAttribute(attr, value)
    }
    set('meta[name="description"]', "content", description)
    set('meta[property="og:title"]', "content", full)
    set('meta[property="og:description"]', "content", description)
    if (opts.path !== undefined) {
      set('link[rel="canonical"]', "href", `${SITE_URL}${opts.path}`)
      set('meta[property="og:url"]', "content", `${SITE_URL}${opts.path}`)
    }
    let robots = document.head.querySelector('meta[name="robots"]')
    if (opts.noindex) {
      if (!robots) {
        robots = document.createElement("meta")
        robots.setAttribute("name", "robots")
        document.head.appendChild(robots)
      }
      robots.setAttribute("content", "noindex, follow")
    } else if (robots) {
      robots.setAttribute("content", "index, follow")
    }
  }, [title, description, opts.path, opts.noindex])
}
