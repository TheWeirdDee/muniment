# RPC resilience and homepage follow-up — 18 October 2026

These changes are prepared locally on top of `dd06c7d`; they are not a claim that the deployed applications have changed.

## Cause and mitigation

The transport previously threw on a long HTTP 429 retry hint before retaining the cooldown. Subsequent calls, new clients and page reloads could therefore send more requests during the same restriction. The homepage also fetched linked records for its decorative preview and loaded renewal candidates automatically.

The transport now retains cooldowns per endpoint and checks them before queued requests are sent. Browser storage shares them across reloads and same-origin tabs when available. Both numeric and HTTP-date retry hints are supported. A missing or CORS-hidden retry hint triggers a conservative 30-second client cooldown; this is a client policy, not an invented server quota. Advertised longer restrictions are respected. Existing bounded successful-read caching and in-flight deduplication remain in place. Writes do not clear the upstream cooldown.

The homepage requests one preview record without fetching linked reviews, loads renewal candidates only on request, and refreshes its block estimate every two minutes. Head polling pauses in hidden tabs. On read failure the hero retains a product explanation and navigation; the actual error and endpoint-settings link are inside an expandable notice. No fictional result is presented as live data, and unloaded reviews are not labelled as absent.

The new problem section and README explain the August 2023 RTIOnline reporting, intended users, motivation and mechanism. Sources: [The Wire](https://m.thewire.in/article/government/rti-portal-rtionline-years-of-information-disappears) and [National Herald](https://www.nationalheraldindia.com/national/rti-years-of-data-go-missing-from-the-union-governments-information-portal). Loss of access at that time is distinguished from proven permanent deletion; the synthetic demo does not claim to recover those applications.

## Changed files

| File | Purpose |
|---|---|
| `packages/muniment-query/src/transport.ts` | Retain and share cooldowns; stop queued calls; conservative missing-header backoff |
| `packages/muniment-query/test/transport.test.ts` | Regressions for new clients, persisted cooldown expiry, queued calls and hidden/missing hints |
| `apps/web/src/lib/hooks.ts` | Pause head polling in hidden tabs and refresh on return |
| `apps/web/src/lib/arkiv.ts` | Explain cooldowns without asserting an unverified transaction outcome |
| `apps/web/src/pages/Landing.tsx` | Reduce reads, useful failure-state presentation, sourced problem and audience sections |
| `tests/e2e/rpc-resilience.spec.ts` | Desktop/phone HTTP 429, cross-tab/reload, accessibility and layout checks |
| `README.md` | Sourced problem, users, mechanism, RPC mitigation and limits; current test inventory |
| `docs/testing.md` | Current inventory while preserving dated earlier results |
| This report | Reproduction, findings and scope |

## Validation

- Package tests: 67 passed across nine files.
- Component regressions: 23 passed across four files.
- Query build, workspace typecheck, web typecheck and production web build/prerender passed.
- Four browser checks passed using intercepted HTTP 429 responses, never public-chain results or a signer. Both desktop and phone cover readable and CORS-hidden retry headers. Initial traffic is bounded to two requests; reloading and opening a second same-origin tab send no additional requests during cooldown. Serious/critical WCAG 2/2.1 A/AA axe assertions and horizontal-overflow checks passed.

Reproduce against a local production preview:

```powershell
npm test
npm run build:query
npm run build -w muniment-web
npm run preview -w muniment-web -- --host 127.0.0.1 --port 4175
# In another terminal:
$env:BASE_URL='http://127.0.0.1:4175'
npx playwright test tests/e2e/rpc-resilience.spec.ts --reporter=line --workers=1
npx vitest run tests/components --maxWorkers=1
```

Initial failures are retained as observations: a first browser fixture did not expose `Retry-After` through CORS and observed eight calls on desktop; the initial phone wait timed out. This led to testing both header conditions and adding the no-hint safeguard. A subsequent package invocation failed one assertion that still matched the old error wording; the matcher was corrected, and the full 66-test rerun passed. Adding an HTTP-date regression brought the final inventory to 67 passing tests. Neither failed invocation is counted as a pass.

## Limits

These changes reduce avoidable traffic and preserve a useful homepage. They cannot lift Arkiv's existing restriction, increase its quota, or guarantee live reads during a cooldown. A 429 response alone does not identify the quota's scope. No independent first-time visitor on a separate connection was available, so that behavior remains unverified. No independent second RPC provider is claimed. Browser storage cannot coordinate different origins, devices, networks or command-line processes. No new blockchain transactions were sent for this follow-up, and historical transaction evidence was not edited.
