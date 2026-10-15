import { TIRAMISU } from "muniment-query"
import { Link } from "react-router"
import { ExternalLink } from "../components/ui"
import { REPO_BLOB } from "../lib/config"
import { usePageMeta } from "../lib/meta"

export default function HowItWorks() {
  usePageMeta("How it works", "What Muniment stores on Arkiv, who can renew or change it, how provenance and renewal verification work, and the limits of each guarantee.", { path: "/how-it-works" })
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">How it works</span>
          <h1>One custodian is one point of failure</h1>
          <p className="lede">
            Replies to information requests are often held by a single portal or a single person's inbox. If either goes away, the answer can go
            with it. Muniment keeps a copy where no single party controls whether it stays readable.
          </p>
        </div>
      </section>
      <div className="wrap prose-layout">
        <nav className="toc" aria-label="On this page">
          <ul>
            <li><a href="#problem">The problem</a></li>
            <li><a href="#mechanism">The mechanism</a></li>
            <li><a href="#provenance">Provenance</a></li>
            <li><a href="#renewal">Renewal verification</a></li>
            <li><a href="#costs">Costs</a></li>
            <li><a href="#why-arkiv">Why Arkiv</a></li>
            <li><a href="#limits">Limits</a></li>
          </ul>
        </nav>
        <div className="prose">
          <section id="problem">
            <h2>The problem</h2>
            <p>
              In August 2023, The Wire and National Herald, citing The Hindu, reported that records of past applications had disappeared from India's
              RTIOnline portal. The portal showed a maintenance notice saying archival data would be available soon, and the department running it did
              not respond to The Hindu's questions.{" "}
              <ExternalLink href="https://m.thewire.in/article/government/rti-portal-rtionline-years-of-information-disappears">The Wire</ExternalLink>,{" "}
              <ExternalLink href="https://www.nationalheraldindia.com/amp/story/national/rti-years-of-data-go-missing-from-the-union-governments-information-portal">National Herald</ExternalLink>.
            </p>
            <p>
              Those reports concern applicants' own application histories on one portal. They do not show why the records went missing, and
              Muniment does not claim to know. The point is narrower: when one operator holds the only copy, everyone who relies on it depends on that
              operator's choices and continued operation.
            </p>
            <p>
              The people affected are the journalists, researchers and applicants who need to cite a reply months or years later. Muniment gives them
              a copy that can be found by structured search, renewed by anyone who values it, and read without this website.
            </p>
          </section>

          <section id="mechanism">
            <h2>The mechanism</h2>
            <ol>
              <li>
                <strong>Publish.</strong> A reply becomes an Arkiv entity. Searchable facts (authority, outcome, filing date, response days, exemption
                section) are typed attributes; the text is the payload. The entity is created <em>read-only</em> and with <em>permissionless
                extension</em>.
              </li>
              <li>
                <strong>Seal.</strong> In the same atomic transaction, ownership of most archive records is handed to{" "}
                <span className="mono">0x…dEaD</span>, a conventional burn address that is widely assumed to have no usable key. On Arkiv, read-only stops edits
                but not deletion by the owner; sealing hands the owner role to that address. In our tests the original publisher's delete attempt on a
                sealed record was rejected. The guarantee rests on the assumption that nobody holds a key for 0x…dEaD. The publisher stays recorded forever as the on-chain creator.
              </li>
              <li>
                <strong>Find.</strong> The archive runs compound Arkiv queries on those attributes, filtered by the creator wallets this deployment
                trusts. Anyone can copy the namespace, so trust comes from <span className="mono">$creator</span>, never from a field the writer sets.
              </li>
              <li>
                <strong>Renew.</strong> Any wallet can move an entity's expiry block later. Muniment bundles a reply with its appeals and exemption
                notes and a renewal receipt into one atomic transaction.
              </li>
              <li>
                <strong>Read independently.</strong> The <a href="/reader.html">standalone reader</a> and the{" "}
                <Link to="/insights">dashboard</Link> read the same entities with no Muniment server.
              </li>
            </ol>
          </section>

          <section id="provenance">
            <h2>Provenance: preserved is not authenticated</h2>
            <p>
              Each record shows the <strong>claimed issuing authority</strong> (what the record says) separately from the <strong>on-chain
              publisher</strong> (the wallet that created it, which Arkiv records and nobody can change). Arkiv proves who submitted what, and when.
              It cannot prove the authority issued the document or that the content is true.
            </p>
            <p>
              Reviews are separate entities: a wallet states that it compared the record with a source, or disputes it, with its method and limits.
              Status badges count only reviewers this site trusts by default, and every other review stays visible. Corrections are new records that
              link to the original; the original is never rewritten.
            </p>
          </section>

          <section id="renewal">
            <h2>How a renewal is verified</h2>
            <p>A receipt entity is just a claim; anyone can write one. Muniment counts a renewal as verified only when chain execution shows all of this:</p>
            <ol>
              <li>The receipt's creation log leads to exactly one transaction, and that transaction succeeded.</li>
              <li>The transaction's sender is the receipt's on-chain creator.</li>
              <li>The same transaction emitted an expiry extension for the reply the receipt names.</li>
              <li>The extended expiry equals the expiry the receipt states.</li>
            </ol>
            <p>
              Anything else is shown as "renewal claim, unverified" and left out of counts. Counts are of <strong>wallets, not people</strong>, and only
              cover receipts that are still live: receipts expire too, so older renewals can drop out of the count. The algorithm is in{" "}
              <ExternalLink href={`${REPO_BLOB}/packages/muniment-query/src/verify.ts`}>verify.ts</ExternalLink>.
            </p>
          </section>

          <section id="costs">
            <h2>Costs</h2>
            <p>
              Reading is free. Creating and renewing are transactions paid in GLM, Arkiv's gas token, priced by the storage work they cause. Before
              you sign, Muniment estimates gas for the exact transaction at the current gas price and shows it in test GLM. It does not convert to any
              currency: on {TIRAMISU.name} GLM is free from the faucet, so these figures show the mechanism, not what preservation would cost on a
              production network.
            </p>
            <p>
              Who would pay in practice (newsrooms, civic groups, researchers maintaining collections) is an untested hypothesis. Muniment sends no
              reminders: the preserve queue and collection exports exist so that keeping records alive doesn't depend on memory alone.
            </p>
          </section>

          <section id="why-arkiv">
            <h2>Why Arkiv</h2>
            <ul>
              <li>
                <strong>A database an operator controls</strong> leaves publication, deletion and read access with that operator. Replication helps,
                but it needs more governance and infrastructure.
              </li>
              <li>
                <strong>IPFS</strong> can keep bytes alive through pinning, but a content hash isn't a searchable archive, and renewal accounting needs
                more parts.
              </li>
              <li>
                <strong>A custom contract plus an indexer</strong> could enforce similar rules, with more contract and indexing work. Arkiv already
                provides typed queries, per-entity expiry, read-only and permissionless-extension flags, creator metadata and atomic batches.
              </li>
            </ul>
            <p>
              Deliberately kept off Arkiv: wallet keys, access credentials, personal data, your collections and private notes, saved searches and
              full-text indexes. Synthetic source fixtures live in the repository, not on chain.
            </p>
          </section>

          <section id="limits">
            <h2>Limits</h2>
            <ul>
              <li>Every record in this edition is synthetic test data. No real government reply, person or office is represented.</li>
              <li>Renewal is not permanence. A record disappears from queries at its expiry block unless someone renews it.</li>
              <li>
                Public reads need a reachable Arkiv endpoint. This edition was tested against one public endpoint; Muniment does not claim several
                independent providers.
              </li>
              <li>Unsealed records (a few in the demo, and any you publish without sealing) can still be deleted or transferred by their owner.</li>
              <li>Expiry or deletion stops new reads; it does not erase copies others already made, or past chain history.</li>
              <li>A link to an external file preserves the link, not the file.</li>
              <li>Wallets are not people. Team test wallets are labelled wherever they appear.</li>
              <li>Tiramisu is a testnet and can be reset. The repository keeps a manifest of every seeded entity and transaction.</li>
            </ul>
            <p>
              Full details: <ExternalLink href={`${REPO_BLOB}/docs/threat-model.md`}>threat model</ExternalLink> ·{" "}
              <ExternalLink href={`${REPO_BLOB}/arkiv/schema.md`}>data contract</ExternalLink> ·{" "}
              <ExternalLink href={`${REPO_BLOB}/docs/testing.md`}>evidence</ExternalLink>.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
