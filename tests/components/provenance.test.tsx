import { expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AppealsSection } from "../../apps/web/src/pages/Record"
import type { Linked } from "../../packages/muniment-query/src/reader.js"
import { PUBLISHER, REVIEWER, k } from "../../packages/muniment-query/test/fixtures.js"
it("attributes foreign linked claims and separates them from the original publisher", () => {
 const linked = { appeals: [{ key:k(1), creator:REVIEWER, filedMs:0, stage:"first-appeal", outcome:"allowed", payload:{grounds:"Foreign synthetic claim"}, expiresAtBlock:100n, permissionlessExtension:true }], exemptions:[{ key:k(2), creator:REVIEWER, section:"8(1)(j)" }], complete:true } as unknown as Linked
 const html = renderToStaticMarkup(createElement(AppealsSection, { linked, parentCreator:PUBLISHER }))
 expect(html).toContain(REVIEWER)
 expect(html).toContain("independently submitted claim")
 expect(html).toContain("proposed relation")
 expect(html).toContain("excluded from its renewal")
 linked.appeals[0].creator=PUBLISHER; linked.exemptions[0].creator=PUBLISHER
 expect(renderToStaticMarkup(createElement(AppealsSection,{linked,parentCreator:PUBLISHER}))).toContain("Same publisher as this reply")
})
