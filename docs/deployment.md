# Deployment

Both apps are static sites on Vercel, in two separate projects so the dashboard is served from a different origin than the archive.

| Vercel project | Domains | Source | Build output |
|---|---|---|---|
| `muniment` | https://muniment-archive.vercel.app (also `muniment-wheat.vercel.app`, Vercel's auto-assigned name) | `apps/web` | `apps/web/dist` (Vite build + `scripts/prerender.mjs`) |
| `muniment-insights` | https://muniment-insights.vercel.app | `apps/dashboard` | `apps/dashboard/dist` |

There is no server, database or secret in either deployment. The browser reads from the public Tiramisu endpoint and signs with the visitor's own wallet.

## Build

```bash
npm ci
npm run build -w muniment-query
npm run build -w muniment-web        # typecheck, vite build, prerender per-route HTML, sitemap, robots, reader
npm run build -w muniment-insights
```

`apps/web/vercel.json` and `apps/dashboard/vercel.json` hold the headers (CSP, HSTS, nosniff, referrer and permissions policies), the cache policy (`/assets/*` immutable for a year) and the record-page rewrite (`/records/:key` → the prerendered record shell, which carries `noindex`). Unknown paths get the prerendered `404.html` with a real 404 status.

CSP allows `connect-src https: wss:` because readers can choose their own Arkiv endpoint, and wallets talk to their own RPC. `reader.html` has its own policy permitting its inline script and style; that is by design, since it must work as a single file.

## Release procedure

1. Build from a clean checkout of the commit being released.
2. `node scripts/deploy-static.mjs apps/web .deploy/web` copies `dist`, writes `version.json` with the exact commit and whether the tree was dirty, and writes a build-free `vercel.json`.
3. `cd .deploy/web && vercel deploy --prod` (the folder is linked to the `muniment` project).
4. The same for `apps/dashboard` → `.deploy/insights` → project `muniment-insights`.
5. Verify: `curl https://muniment-archive.vercel.app/version.json` shows the released commit; then run the browser suite against production (`npx playwright test`).

Git integration: the projects can be connected to the GitHub repository with root directories `apps/web` and `apps/dashboard`. The build commands in `apps/*/vercel.json` run from the repository root (`cd ../.. && npm ci && …`), because the apps depend on the workspace package.

## Rollback

`vercel rollback <previous-deployment-url>` in the linked folder, or promote an earlier deployment in the Vercel dashboard. Static deployments are immutable, so a rollback restores the exact previous files.

## Judging uptime

Deployments stay live through 23 October 2026. Demo records were created with lifetimes of 21 to 180 days on 15 October 2026, so the earliest expire around 5 November 2026. The proof campaign's short-lived control entities are separate and labelled `kind = "control"`.
