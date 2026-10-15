# Copy and design audit (15 October 2026)

Findings from the inspected design/copy brief, with the change made and where it now lives. "Before" refers to the deployment captured in `evidence/screens/before/`.

| ID | Before | After | Where / why |
|---|---|---|---|
| VIS-01 | Purple, neon lime and peach (reference identity) | Near-black canvas with Moss, Mustard and Eggshell | `apps/web/src/styles/tokens.css`, logo, OG image, reader, dashboard |
| VIS-02 | Hero headline split into four very large lines; actions pushed down | "Public answers. / Worth keeping." in two lines on desktop; lede, primary action and scope note in the first viewport | Landing hero |
| VIS-03 | Full desktop links plus a hamburger at once; wallet, theme and network crowded the header | Archive · Collections · How it works · More; one Settings control (theme, endpoint, wallet); menu button only below 900 px | `Layout.tsx` |
| VIS-04 | Empty record stack labelled "Live from Arkiv" with "Kept available —" | The card shows a real record (topic, claimed authority, source status, stored-until date, block), or "No demo records are available yet", or the real read error | `RecordPreview` |
| VIS-05 | "KEEP KEEP" background lettering and a giant "0" | Removed; closing band "Find a reply worth keeping." with one action | Landing closing |
| VIS-06 | Strongly tilted layered surfaces throughout | One bounded hero stage with small rotations; all data panels flat | `pages.css` |
| CPY-01 | "Saved isn't proven" right after the hero | Task first (Find → Save → Renew); provenance later as "Know where a reply came from", with a source-status label on every preview | Landing order |
| CPY-02 | Raw RPC query playground on the landing page | Simple question chips and an authority picker; playground moved to Developers | `QueryDemo.tsx` |
| CPY-03 | Keep / preserve / save / renew used interchangeably | "Save to collection" = local bookmark; "Renew storage" = on-chain lifetime extension | All pages |
| CPY-04 | "New expiry block +180 days" | Illustration removed; renewal UI states the target **block** and the approximate date separately | `RenewDialog.tsx` |
| CPY-05 | Reader illustration named `muniment.vercel.app` | Illustration removed; the reader section states what it needs and doesn't | Landing reader section |
| CPY-06 | "Sealed… no key exists"; implied no published record can be removed | "Sent to 0x…dEaD, a conventional burn address assumed to have no usable key"; unsealed records labelled "publisher can still delete" | Record page, Publish, How it works, reader |
| INT-01 | Archive and dashboard showed zero records | Cause: nothing had been published yet (wallets unfunded). Corpus seeded through real transactions; see `evidence/manifest.json` | — |
| INT-02 | Links to schema, tests and a release tarball that were not published | Repository published; every link checked after release | Footer, Developers |

## Page introductions

| Page | New heading |
|---|---|
| Archive | Find replies by authority, topic or outcome. |
| Preserve | Add time to records nearing expiry. |
| Collections | Keep related replies together. |
| Publish | Try publishing a synthetic reply. |
| Insights | Explore response times in the demo archive. |
