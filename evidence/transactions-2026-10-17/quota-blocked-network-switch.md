# Test info

- Name: live.spec.ts >> a wallet on another network must switch to Tiramisu before signing
- Location: tests\e2e\live.spec.ts:102:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog').getByRole('button', { name: /^Sign / })
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog').getByRole('button', { name: /^Sign / }) with timeout 20000ms
  - waiting for getByRole('dialog').getByRole('button', { name: /^Sign / })

```

```yaml
- link "Skip to content":
  - /url: "#main"
- text: Testnet demo · Synthetic government replies
- link "What that means":
  - /url: /how-it-works#limits
- banner:
  - link "Muniment home":
    - /url: /
    - text: Muniment
  - navigation "Primary":
    - list:
      - listitem:
        - link "Archive":
          - /url: /archive
      - listitem:
        - link "Collections":
          - /url: /collections
      - listitem:
        - link "How it works":
          - /url: /how-it-works
      - listitem:
        - button "More"
  - button "Settings"
  - link "Explore the archive":
    - /url: /archive
- main:
  - article:
    - navigation "Breadcrumb":
      - link "Archive":
        - /url: /archive
      - text: / 0x4e0dc2…90647f
    - text: Synthetic test record Checking reviews… Information supplied
    - heading "Storm-water drainage, Ward 7, 2024-25 (synthetic)" [level=1]
    - paragraph:
      - text: "Claimed issuer:"
      - strong: Ravipur Municipal Corporation (synthetic)
      - text: · Sundarvan (fictional state) · ref RMC/RTI/2025/R03
    - region "Question asked":
      - text: Filed 1 Dec 2025 Replied 22 Dec 2025 Replied in 21 days
      - heading "Question asked" [level=2]
      - paragraph: Please provide the estimates, tender documents and completion certificates for storm-water drain works in Ward 7 during 2024-25, and the amount paid against each.
      - heading "Reply" [level=2]
      - paragraph: 5 drain works were taken up in Ward 7 in 2024-25. 4 are complete and certified; the remainder are in progress. Payments released total 1.9 crore. Copies of estimates and certificates are enclosed (synthetic).
      - paragraph: Synthetic test record published for the Muniment hackathon demo on the Arkiv Tiramisu testnet. Not a real government reply.
    - region "Provenance":
      - heading "Provenance" [level=2]
      - text: What Arkiv can show, and what it cannot
      - term: Claimed issuing authority
      - definition: Ravipur Municipal Corporation (synthetic) (stated in the record; not verified by Arkiv)
      - term: Published by (on-chain creator)
      - definition:
        - link "0x817574740F413816636FAE23064607084e2C0604 (opens in a new tab)":
          - /url: https://tiramisu.explorer.arkiv.network/address/0x817574740F413816636FAE23064607084e2C0604
        - text: · Muniment test publisher (team wallet) A publisher this site trusts by default. Trust is a choice, not a certificate.
      - term: Published at
      - definition: block 626,671 (≈ 15 Oct 2026, 22:25 UTC)
      - term: Creation transaction
      - definition:
        - link "0x19599a0c…dcc2de90 (opens in a new tab)":
          - /url: https://tiramisu.explorer.arkiv.network/tx/0x19599a0c4e146aef8fbb7ddedad85203dfebc6dbb47d572aaa32f477dcc2de90
      - term: Content changes
      - definition: "Frozen: created read-only, so nobody can edit it"
      - term: Deletion
      - definition: "Sealed: ownership was sent to 0x…dEaD, a conventional burn address assumed to have no usable key. While that holds, no wallet can delete or transfer it. It can still expire."
      - term: Claimed source
      - definition: "RMC/RTI/2025/R03 · dated 22 Dec 2025 Synthetic record: there is no live source to compare against."
      - paragraph: Preservation proves what was submitted, by which wallet and when. It does not prove that the named authority issued this document or that its contents are true.
    - strong: Linked records could not be loaded
    - text: The public Arkiv endpoint is rate limiting this connection for about 3079 seconds. Nothing failed on chain; try again shortly, or use your own endpoint in Settings.
    - complementary "Preservation":
      - heading "Preservation" [level=2]
      - text: Live updates
      - term: Expires at block
      - definition: 8,407,095
      - term: Approximately
      - definition: 14 Apr 2027, 00:52 UTC
      - term: Time left
      - definition: ≈ 178 days left
      - term: Who can renew
      - definition: Any wallet (permissionless extension)
      - button "Renew storage"
      - button "Save to collection"
      - paragraph: Block-to-date conversions assume 2-second blocks and are approximate.
      - button "Re-read from Arkiv"
      - group: Chain evidence +
- contentinfo:
  - paragraph: Muniment keeps public answers findable and renewable on Arkiv, so they don't depend on one website or one uploader.
  - paragraph: Built for the Arkiv Global Tour Stop, October 2026. Open source under the MIT licence.
  - heading "Archive" [level=2]
  - list:
    - listitem:
      - link "Search replies":
        - /url: /archive
    - listitem:
      - link "Preserve queue":
        - /url: /preserve
    - listitem:
      - link "Your collections":
        - /url: /collections
    - listitem:
      - link "Publish a synthetic record":
        - /url: /publish
  - heading "Read independently" [level=2]
  - list:
    - listitem:
      - link "Standalone reader":
        - /url: /reader.html
    - listitem:
      - link "Response-time dashboard (opens in a new tab)":
        - /url: https://muniment-insights.vercel.app
    - listitem:
      - link "Data contract & queries":
        - /url: /developers
    - listitem:
      - link "Tiramisu explorer (opens in a new tab)":
        - /url: https://tiramisu.explorer.arkiv.network
  - heading "Project" [level=2]
  - list:
    - listitem:
      - link "How it works":
        - /url: /how-it-works
    - listitem:
      - link "Source code (opens in a new tab)":
        - /url: https://github.com/TheWeirdDee/muniment
    - listitem:
      - link "Friction report (opens in a new tab)":
        - /url: https://github.com/TheWeirdDee/muniment/blob/main/arkiv/friction.md
    - listitem:
      - link "Evidence & testing (opens in a new tab)":
        - /url: https://github.com/TheWeirdDee/muniment/blob/main/docs/testing.md
  - text: Testnet · synthetic data © 2026 Muniment contributors · MIT licence
  - list:
    - listitem:
      - link "Privacy":
        - /url: /privacy
    - listitem:
      - link "Terms":
        - /url: /terms
    - listitem:
      - link "Report a problem (opens in a new tab)":
        - /url: https://github.com/TheWeirdDee/muniment/issues
    - listitem:
      - link "Back to top ↑":
        - /url: "#top"
- dialog "Renew storage for this record":
  - heading "Renew storage for this record" [level=2]
  - button "Close dialog"
  - paragraph: Renewing storage moves each record's expiry block later. Your wallet pays the storage fee in test GLM; it gains no right to change the content. Linked appeals and exemption notes from the same publisher renew in the same atomic transaction, together with a public receipt that anyone can check.
  - group "Renew storage until about":
    - text: Renew storage until about
    - group "Coverage":
      - button "30 days from now"
      - button "90 days from now"
      - button "180 days from now" [pressed]
      - button "1 year from now"
    - text: Converted to a block height at 2 seconds per block. Block production is not a clock, so dates are approximate.
  - alert:
    - strong: Could not read current state
    - text: The public Arkiv endpoint is rate limiting this connection for about 3079 seconds. Nothing failed on chain; try again shortly, or use your own endpoint in Settings.
  - button "Cancel"
  - button "Sign" [disabled]
```

# Test source

```ts
  12  | const manifest = JSON.parse(readFileSync(join(ROOT, "evidence", "manifest.json"), "utf8")) as { entries: { id: string; kind: string; key: string }[] }
  13  | const replyKey = (id: string) => manifest.entries.find((e) => e.id === id && e.kind === "reply")!.key
  14  | const DASHBOARD = process.env.DASHBOARD_URL || "https://muniment-insights.vercel.app"
  15  |
  16  | test.describe.configure({ mode: "serial" })
  17  |
  18  | test("landing shows a real record, not a placeholder", async ({ page }) => {
  19  |   await page.goto("/")
  20  |   const card = page.locator(".stage .record-card")
  21  |   await expect(card).toContainText(/Live from Arkiv/, { timeout: 45_000 })
  22  |   await expect(card).toContainText(/Claimed authority/)
  23  |   await expect(card).toContainText(/Stored until about/)
  24  |   await expect(card).not.toContainText("No demo records")
  25  | })
  26  |
  27  | test("archive lists the seeded corpus and filters with a real range query", async ({ page }) => {
  28  |   await page.goto("/archive?outcome=denied")
  29  |   await expect(page.locator(".reply-row").first()).toBeVisible({ timeout: 45_000 })
  30  |   await expect(page.locator(".reply-row")).toHaveCount(7)
  31  |   await page.goto("/archive?rmin=31")
  32  |   await expect(page.locator(".reply-row").first()).toBeVisible({ timeout: 45_000 })
  33  |   for (const t of await page.locator(".reply-row-meta").allInnerTexts()) {
  34  |     const m = /Replied in (\d+) days/.exec(t)
  35  |     expect(m, t).not.toBeNull()
  36  |     expect(Number(m![1])).toBeGreaterThanOrEqual(31)
  37  |   }
  38  | })
  39  |
  40  | test("a sealed record shows provenance, review status and sealing", async ({ page }) => {
  41  |   await page.goto(`/records/${replyKey("r01")}`)
  42  |   await expect(page.getByRole("heading", { level: 1 })).toContainText(/synthetic/i, { timeout: 45_000 })
  43  |   await expect(page.getByText(/Claimed issuing authority/)).toBeVisible()
  44  |   await expect(page.getByText(/Sealed: ownership was sent to 0x…dEaD/)).toBeVisible()
  45  |   await expect(page.getByText(/Source compared/).first()).toBeVisible({ timeout: 45_000 })
  46  | })
  47  |
  48  | test("the disputed and corrected examples render their states", async ({ page }) => {
  49  |   await page.goto(`/records/${replyKey("r11")}`)
  50  |   await expect(page.getByText(/A reviewer you trust disputes this record/)).toBeVisible({ timeout: 45_000 })
  51  |   await page.goto(`/records/${replyKey("r17")}`)
  52  |   await expect(page.getByText(/The publisher has issued a correction/)).toBeVisible({ timeout: 45_000 })
  53  |   await page.goto(`/records/${replyKey("r41")}`)
  54  |   await expect(page.getByText(/This record is a correction/)).toBeVisible({ timeout: 45_000 })
  55  | })
  56  |
  57  | test("an unsealed record says the publisher can still delete it", async ({ page }) => {
  58  |   await page.goto(`/records/${replyKey("r04")}`)
  59  |   await expect(page.getByText(/Publisher-held: the owner wallet can still delete/)).toBeVisible({ timeout: 45_000 })
  60  | })
  61  |
  62  | test("standalone reader works from disk with the main site blocked", async ({ page, baseURL }) => {
  63  |   const host = new URL(baseURL!).host
  64  |   const blocked: string[] = []
  65  |   await page.route(`**://${host}/**`, (route) => {
  66  |     blocked.push(route.request().url())
  67  |     return route.abort("blockedbyclient")
  68  |   })
  69  |   await page.goto(pathToFileURL(join(ROOT, "reader", "reader.html")).href)
  70  |   await expect(page.locator("#net")).toContainText(/Connected: Arkiv Tiramisu/, { timeout: 45_000 })
  71  |   await page.locator("#key").fill(replyKey("r01"))
  72  |   await page.getByRole("button", { name: "Read record" }).click()
  73  |   await expect(page.locator("#detail")).toContainText(/Synthetic test record/, { timeout: 45_000 })
  74  |   await expect(page.locator("#detail")).toContainText(/0x817574740F413816636FAE23064607084e2C0604/i)
  75  |   // The reader never contacted the main site.
  76  |   expect(blocked).toEqual([])
  77  | })
  78  |
  79  | test("the separately hosted dashboard reads the same corpus", async ({ page }) => {
  80  |   await page.goto(DASHBOARD)
  81  |   await expect(page.locator("#coverage")).toContainText(/41 live synthetic replies/, { timeout: 60_000 })
  82  |   await expect(page.locator(".heat")).toBeVisible()
  83  |   await expect(page.locator("#table tbody tr")).toHaveCount(5)
  84  | })
  85  |
  86  | test("a rejected wallet signature sends nothing and says so", async ({ page }) => {
  87  |   test.skip(!process.env.RENEWER_KEY, "needs RENEWER_KEY")
  88  |   const wallet = await injectTestWallet(page, { key: process.env.RENEWER_KEY as `0x${string}`, reject: true })
  89  |   await page.goto(`/records/${replyKey("r03")}`)
  90  |   await page.getByRole("button", { name: "Renew storage" }).click()
  91  |   const dialog = page.getByRole("dialog")
  92  |   await expect(dialog.getByText(/Estimated cost/)).toBeVisible({ timeout: 60_000 })
  93  |   await dialog.getByRole("button", { name: /Connect a wallet/ }).click()
  94  |   await dialog.getByRole("button", { name: /^Sign / }).click()
  95  |   await expect(dialog.getByText(/You declined the request in your wallet. Nothing was sent./)).toBeVisible({ timeout: 30_000 })
  96  |   // A parent refresh must not erase the result or silently reset the transaction controls.
  97  |   await page.waitForTimeout(2000)
  98  |   await expect(dialog.getByText(/You declined the request in your wallet. Nothing was sent./)).toBeVisible()
  99  |   expect(wallet.sent).toEqual([])
  100 | })
  101 |
  102 | test("a wallet on another network must switch to Tiramisu before signing", async ({ page }) => {
  103 |   test.skip(!process.env.RENEWER_KEY, "needs RENEWER_KEY")
  104 |   const wallet = await injectTestWallet(page, { key: process.env.RENEWER_KEY as `0x${string}`, chainIdHex: "0x1", reject: true })
  105 |   await page.goto(`/records/${replyKey("r03")}`)
  106 |   await page.getByRole("button", { name: "Renew storage" }).click()
  107 |   const dialog = page.getByRole("dialog")
  108 |   await dialog.getByRole("button", { name: /Connect a wallet/ }).click()
  109 |   await expect(dialog.getByRole("button", { name: "Switch to Tiramisu" })).toBeVisible()
  110 |   await expect(dialog.getByRole("button", { name: /^Sign / })).toHaveCount(0)
  111 |   await dialog.getByRole("button", { name: "Switch to Tiramisu" }).click()
> 112 |   await expect(dialog.getByRole("button", { name: /^Sign / })).toBeVisible()
      |                                                                ^ Error: expect(locator).toBeVisible() failed
  113 |   expect(wallet.sent).toEqual([])
  114 | })
  115 |
  116 | test("a quote older than five minutes stops before asking for a signature", async ({ page }) => {
  117 |   test.skip(!process.env.RENEWER_KEY, "needs RENEWER_KEY")
  118 |   const wallet = await injectTestWallet(page, { key: process.env.RENEWER_KEY as `0x${string}`, reject: true })
  119 |   await page.goto(`/records/${replyKey("r03")}`)
  120 |   await page.getByRole("button", { name: "Renew storage" }).click()
  121 |   const dialog = page.getByRole("dialog")
  122 |   await dialog.getByRole("button", { name: /Connect a wallet/ }).click()
  123 |   const sign = dialog.getByRole("button", { name: /^Sign / })
  124 |   await expect(sign).toBeEnabled({ timeout: 60_000 })
  125 |   // Advance wall time only; keep real network responses and transaction state intact.
  126 |   await page.clock.setSystemTime(Date.now() + 6 * 60_000)
  127 |   await sign.click()
  128 |   await expect(dialog.getByText(/Transaction 1: Quote out of date/)).toBeVisible({ timeout: 30_000 })
  129 |   expect(wallet.sent).toEqual([])
  130 | })
  131 |
  132 | test("a different wallet renews a record through the UI and the new expiry is read back", async ({ page }) => {
  133 |   test.skip(!process.env.RENEWER_KEY || !process.env.E2E_SIGN, "set E2E_SIGN=1 and RENEWER_KEY to sign a real renewal")
  134 |   const w = await injectTestWallet(page, { key: process.env.RENEWER_KEY as `0x${string}` })
  135 |   await page.goto(`/records/${replyKey("r03")}`)
  136 |   await page.getByRole("button", { name: "Renew storage" }).click()
  137 |   const dialog = page.getByRole("dialog")
  138 |   await expect(dialog.getByText(/Estimated cost/)).toBeVisible({ timeout: 60_000 })
  139 |   await dialog.getByRole("button", { name: /Connect a wallet/ }).click()
  140 |   await dialog.getByRole("button", { name: /^Sign / }).click()
  141 |   await expect(dialog.getByText(/Verified renewal/)).toBeVisible({ timeout: 180_000 })
  142 |   expect(w.sent.length).toBe(1)
  143 |   console.log(`UI renewal tx: ${w.sent[0]}`)
  144 | })
  145 |
```