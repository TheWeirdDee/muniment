import { TIRAMISU } from "muniment-query"
import { ExternalLink } from "../components/ui"
import { REPO_URL } from "../lib/config"
import { usePageMeta } from "../lib/meta"

export default function Legal({ kind }: { kind: "privacy" | "terms" }) {
  usePageMeta(
    kind === "privacy" ? "Privacy" : "Terms of use",
    kind === "privacy" ? "What Muniment stores in your browser, what becomes public on Arkiv, and what the hosting provider may log." : "Terms for using the Muniment hackathon edition on the Arkiv Tiramisu testnet.",
    { path: `/${kind}` },
  )
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">{kind === "privacy" ? "Privacy" : "Terms"}</span>
          <h1>{kind === "privacy" ? "Privacy and data" : "Terms of use"}</h1>
          <p className="lede">Plain-language notes written by the project team. They have not been reviewed by a lawyer.</p>
        </div>
      </section>
      <div className="wrap prose" style={{ paddingBlock: "var(--space-7)", maxWidth: "52rem" }}>
        {kind === "privacy" ? (
          <>
            <h2>No accounts, no analytics</h2>
            <p>Muniment has no sign-up, no cookies for tracking and no analytics scripts. There is no Muniment database or backend.</p>
            <h2>Stored in your browser</h2>
            <p>
              These stay on your device in local storage: your collections and private notes, your theme choice, your network settings and whether
              to reconnect your wallet. Clearing site data deletes them. They are never sent to Muniment or to Arkiv, and never put in URLs.
            </p>
            <h2>Public on Arkiv</h2>
            <p>
              Anything you publish, renew or review is a public transaction on the {TIRAMISU.name}: the content, your wallet address and the time. It
              can be read and copied by anyone and cannot be made private later. Deletion or expiry stops new reads but does not erase copies already
              made. Never publish real personal data; this edition accepts synthetic templates only.
            </p>
            <h2>Requests your browser makes</h2>
            <p>
              Your browser talks directly to the Arkiv RPC endpoint you use (by default the public Tiramisu endpoint run by Arkiv), which can see your
              IP address and the queries you send, under Arkiv's own <ExternalLink href="https://arkiv.network/privacy">privacy policy</ExternalLink>. Your
              wallet extension talks to whichever RPC it is configured with.
            </p>
            <h2>Hosting</h2>
            <p>
              The site's static files are served by Vercel, which may keep standard request logs (such as IP address, user agent and requested path)
              under its own policies. Record pages put only a public entity key in the URL; collection contents never appear in URLs.
            </p>
          </>
        ) : (
          <>
            <h2>What this is</h2>
            <p>
              Muniment is an open-source hackathon project (MIT licence) demonstrated on the {TIRAMISU.name}. All records are synthetic test data. It is
              not a government service, an official archive or a source of legal advice.
            </p>
            <h2>No guarantees</h2>
            <p>
              The software is provided as is, without warranty. Testnet networks can be reset or go offline, endpoints can be rate limited, and records
              expire unless renewed. Do not rely on this edition to preserve anything important.
            </p>
            <h2>Your responsibilities</h2>
            <p>
              You are responsible for the transactions you sign. Publish only the synthetic templates offered. Do not attempt to publish real personal
              data, secrets or unlawful content. Test GLM has no monetary value.
            </p>
            <h2>Arkiv network</h2>
            <p>
              Use of the public RPC is subject to Arkiv's <ExternalLink href="https://arkiv.network/terms">terms of use</ExternalLink>.
            </p>
            <h2>Contact</h2>
            <p>
              Report problems on <ExternalLink href={`${REPO_URL}/issues`}>GitHub</ExternalLink>.
            </p>
          </>
        )}
      </div>
    </>
  )
}
