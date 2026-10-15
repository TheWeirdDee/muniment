# Third-party notices

Muniment is MIT licensed. It depends on the following directly declared packages, each under its own licence (versions pinned in `package-lock.json`). Their full licence texts ship inside each package in `node_modules`.

| Package | Version | Licence | Used for |
|---|---|---|---|
| @arkiv-network/sdk | 0.8.1 | MIT (LICENSE.md, © 2025 Arkiv Network) | Arkiv reads, writes and events |
| viem | 2.57.7 | MIT | Ethereum transport, ABI, accounts |
| react, react-dom | 19.3.1 | MIT | Main app UI |
| react-router | 8.4.0 | MIT | Routing |
| @fontsource-variable/archivo | 5.3.0 | SIL Open Font License 1.1 | Archivo typeface (self-hosted) |
| @fontsource-variable/jetbrains-mono | 5.3.0 | SIL Open Font License 1.1 | JetBrains Mono typeface (self-hosted) |
| vite, @vitejs/plugin-react | 8.3.4, 6.1.2 | MIT | Build |
| typescript | 5.9.3 | Apache-2.0 | Type checking |
| tsx | 4.21.0 | MIT | Running scripts |
| vitest | 4.1.11 | MIT | Unit tests |
| @playwright/test | 1.64.1 | Apache-2.0 | Browser tests, screenshots, brand-asset rendering |
| @axe-core/playwright | 4.13.0 | MPL-2.0 | Accessibility checks (development only) |

Brand assets (`apps/web/public/*.svg`, `*.png`, `og.png`) are original to this project and rendered by `apps/web/scripts/brand-assets.mjs`; they are covered by the project's MIT licence. The palette (Moss #576238, Mustard #FFD95D, Eggshell #F0EADC) came from a palette card supplied by the project owner.

The synthetic corpus (`scripts/corpus.ts`, `corpus/sources/`) is original fictional content.
