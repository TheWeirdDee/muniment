# Contributing

Start with the [README](README.md), [schema](arkiv/schema.md) and [threat model](docs/threat-model.md). Use Node 20.19+ and npm 11; read-only development needs no private keys.

Report reproducible defects through [GitHub issues](https://github.com/TheWeirdDee/muniment/issues), including the source revision, route, public entity key, expected behavior and exact error. Distinguish missing data, malformed data and endpoint failure. Use the [security policy](SECURITY.md) for suspected vulnerabilities.

Keep changes focused and add regression coverage for state, query or protocol changes. Preserve historical failures and transaction evidence. Use synthetic fixtures and disclose whether tests use simulated providers or real testnet operations. Never commit credentials, private notes, wallet files or secret environment files.

Run:

```sh
npm ci --ignore-scripts
npm run build:query
npm test
node node_modules/vitest/vitest.mjs run tests/components
npm run typecheck
npm run build -w muniment-web
npm run build -w muniment-insights
npx playwright install chromium
npx playwright test --config playwright.audit.config.ts
```

The CI workflow runs these read-only checks. Its browser suite uses intercepted RPC and synthetic providers, never real keys or chain writes. Existing live suites are separate: do not run seed, proof, publication or renewal campaigns without explicit authorization and funded testnet-only accounts.

Keep schema/query behavior consistent across the query package, archive, reader and Insights. Preserve licence notices and required AI-use disclosure. Commit messages must not add unsolicited coauthor trailers.
