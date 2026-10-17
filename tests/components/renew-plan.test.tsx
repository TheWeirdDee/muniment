import { expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router"
import { RenewalPlanReview } from "../../apps/web/src/components/RenewalPlanReview"
import type { Quote } from "../../apps/web/src/lib/renew"
import { k } from "../../packages/muniment-query/test/fixtures"
it("shows every reviewed entity with current and target expiry grouped by transaction and reply",()=>{
  const quote={plan:{targetBlock:1000n,batches:[[{reply:k(1),items:[{key:k(1),kind:"reply",expiresAtBlock:300n},{key:k(2),kind:"appeal",expiresAtBlock:400n}]}],[{reply:k(3),items:[{key:k(3),kind:"reply",expiresAtBlock:500n},{key:k(4),kind:"exemption",expiresAtBlock:600n}]}]]}} as Quote
  const html=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(RenewalPlanReview,{quote})))
  for(const n of [1,2,3,4])expect(html).toContain(k(n))
  for(const n of [300,400,500,600])expect(html).toContain(`Current expiry: block ${n}`)
  expect(html.match(/Target expiry: block 1,000/g)).toHaveLength(4)
  expect(html).toContain("Transaction 2 included entities")
  expect(html).toContain("Copy exemption key")
})
