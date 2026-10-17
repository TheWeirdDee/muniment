import type { Quote } from "../lib/renew"
import { formatBlock } from "../lib/format"
import { CopyButton } from "./ui"
import { Link } from "react-router"

/** The exact extension set retained in the quote, grouped as it will be signed. */
export function RenewalPlanReview({ quote }: { quote: Quote }) {
  return <div className="stack-sm" aria-label="Included entities">
    {quote.plan.batches.map((batch, index) => <section key={index} aria-label={`Transaction ${index + 1} included entities`}>
      <h3>Transaction {index + 1}</h3>
      {batch.map(unit => <div className="stack-sm" key={unit.reply}>
        <p>Reply: <Link className="hash" to={`/records/${unit.reply}`}>{unit.reply}</Link></p>
        <ul className="stack-sm" style={{ paddingLeft: "1.1rem" }}>
          {unit.items.map(item => <li key={item.key}>
            <strong>{item.kind}</strong>{" "}<span className="hash">{item.key}</span>{" "}<CopyButton value={item.key} label={`Copy ${item.kind} key`} />
            <div>Current expiry: block {item.expiresAtBlock === null ? "unknown" : formatBlock(item.expiresAtBlock)}. Target expiry: block {formatBlock(quote.plan.targetBlock)}.</div>
          </li>)}
        </ul>
      </div>)}
    </section>)}
    <p className="faint">These entity keys and target blocks are the plan being signed. One new public receipt is created per reply. Dates are approximate; block heights define expiry.</p>
  </div>
}
