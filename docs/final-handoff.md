# Muniment correction handoff — 16 October 2026

**Latest independent audit:** See [audit-remediation.md](audit-remediation.md) for the subsequent corrections, verification and unresolved submission declarations. Package `0.1.1` is published. The corrected application source is local; pushing main and deploying it remain blocked by automatic approval review. The production results below describe the earlier revision, not these latest fixes.

Work continued from main at `c4dabfe46f1757cd37da4cb7f79b5b08de794b46`, already containing the redesign, 41-reply curated corpus, proof campaign, package and narrated 1:44 demo. Existing user changes were retained, including the initial before/after screenshots. All subsequent commits use the configured author and exactly one explicit staged file. No shared history was rewritten.

## Public deliverables

- Archive: https://muniment-archive.vercel.app/
- Dashboard: https://muniment-insights.vercel.app/
- Independent reader: https://muniment-archive.vercel.app/reader (download via the site's Download reader action).
- Repository and reproduction instructions: https://github.com/TheWeirdDee/muniment
- Schema: https://github.com/TheWeirdDee/muniment/blob/main/arkiv/schema.md
- Friction and evidence: https://github.com/TheWeirdDee/muniment/blob/main/arkiv/friction.md · https://github.com/TheWeirdDee/muniment/blob/main/docs/testing.md
- Package: https://github.com/TheWeirdDee/muniment/releases/download/muniment-query-v0.1.0/muniment-query-0.1.0.tgz
- Demo: https://github.com/TheWeirdDee/muniment/releases/download/demo-2026-10-16/muniment-demo.mp4
- Captions: https://github.com/TheWeirdDee/muniment/releases/download/demo-2026-10-16/muniment-demo.srt
- Submission answers: https://github.com/TheWeirdDee/muniment/blob/main/docs/submission.md

The existing Vercel projects deploy from Git; no replacement projects or domains were created. Production revision evidence is in `evidence/release-check.json`; check both `/version.json` endpoints for the final pushed revision after this document's commit. A local build is not presented as deployment evidence.

## Changes and evidence

- Kept renewal results across parent refreshes; recovered wallet rejection code 4001 through nested SDK errors. Local and production rejection tests pass and assert zero transactions sent.
- Started the advertised 30-second fallback polling after connection timeout; reconcile immediately on event-stream recovery. A real 35-second browser outage followed by fresh state passes locally and in production. Longer outages remain untested.
- Fixed reader form constraints and long footer URL wrapping. All nine requested widths, including 320 px and 1920 px, pass in both themes. Fixed the hosted reader separately: Vercel clean URLs had bypassed its inline-script policy, leaving controls inactive despite successful disk-based tests. The regression test checks actual control initialisation.
- Removed peach/red and extra green status accents from web, reader and dashboard. Brand mapping: near-black `#111114` canvas, Moss `#576238` panels, Mustard `#FFD95D` actions, Eggshell `#F0EADC` text and paper. Status labels distinguish meaning; palette contrast measurements are in `docs/design-reference-notes.md`.
- Updated the dashboard heading and scope: its source documents and authorities are fictional, while its displayed summaries are calculated from live Arkiv records.
- Exposed confirmed publication and transaction links immediately; bounded readback and distinguished delayed visibility from failure. One real stranger-wallet publication is confirmed in `evidence/ui-publication-confirmed.json`; its initial browser readback was blocked by the RPC budget, so it is not counted as a passing readback test.
- Real concurrent renewals both reached the same absolute expiry target in block 644704. The original exclusive-winner expectation failed; both runs remain in the evidence. Successful transactions do not imply additive coverage. See friction entry 15.
- Published the revised PRD with confirmed Censorship Resistance and Open Source eligibility. No Indian-nationality declaration or Best Indian Use Case entry is prepared.

The landing's existing corrected sequence remains task → real preview → Find/Save/Renew → preservation → provenance → independent reader → reuse → FAQ → archive action. Copy inventory is in `docs/copy-audit.md`. Desktop hero actions and a real record are visible at 1440×720 in `evidence/visual-final/home-1440-dark-motion-fold.png`.

Motion uses 620 ms section entrances and a small hover/focus card lift, with bounded layering and reduced-motion final positions. Two actual motion recordings are under `evidence/visual-final/motion` and `evidence/visual-audit/motion`. These are movement captures, not a quantified frame-rate guarantee. Reference tablet captures supplement the earlier desktop/mobile inspection; no animation-library claim is made about the references.

## Verification and reproduction

`npm test`: 42 passed. Workspace typechecking and both app builds pass. Production desktop: 35 passed, one optional signed renewal skipped (the film already contains a verified renewal). The initial phone run passed 24 checks and hit the public query quota on two assertions. After honouring Retry-After, the phone live suite passed all 10 checks (one optional signed-renewal test skipped), and the missing-record rerun passed. Both hosted-reader initialisation and the existing production publication's readback passed on desktop and phone. Original failures remain disclosed. All six phone axe checks passed.

The 216-check production layout audit found six narrow-reader failures; all 18 affected reader width/theme combinations then passed after the fix. A further 180 measurements with page-level clipping disabled passed, and the global overflow rule was removed from source. Reports and screenshots are in `evidence/visual-final` and `evidence/reader-final`. Captures include honest loading states and cannot establish successful data retrieval on their own.

Run `npm ci`, `npm run build:query`, `npm test`, `npm run typecheck`, then both app builds as documented. `npx playwright test` targets production by default. Use `node --env-file=.env --import tsx scripts/resilience.ts` only for a new deliberate Tiramisu control campaign. The optional signed publish test creates a real public synthetic record; inspect existing evidence before rerunning after any broadcast. Keys remain in the existing ignored secure setup and are never requested in chat.

The later direct publication read is in `evidence/ui-publication-readback.json`; phone and desktop browser readbacks are in `evidence/remaining-readbacks.json`. Signing guards for wrong-network switching and an aged quote also passed on the phone without sending transactions. The original publication was never resubmitted.

## Wallets and transactions

Balances observed at 2026-10-16T10:21:06.733Z, Tiramisu chain 7738577, test GLM only:

| Role | Address | Test GLM |
|---|---|---|
| PUBLISHER | `0x817574740F413816636FAE23064607084e2C0604` | 9.98642001997484004 |
| RENEWER | `0xe0e47735c1add1390E03766D7Bd06eC913485DE7` | 9.999112207998224416 |
| REVIEWER | `0xeC5C622d43217c5DA7C006be11909c0Fb6fFf5C1` | 8.999752991997505984 |
| STRANGER | `0x5F2b31286708083Aa5D097bD89d5b3F48DD6cBC9` | 0.999610683999221368 |

No additional funding transfer was needed. The stranger was already funded from the earlier campaign. All four wallets are team test wallets.

The 41 curated replies and their creation transactions remain in `evidence/manifest.json`. The additional UI-published record is `0xc7ccf28706bdfc660d65f39c697c3e37418bad566f2fb18b6abea4381f13bb33`, created by transaction `0x3692206b22200de5597d1cade471150f462cc7cfa12167a9c0e8ba9c8fa9e295` in block 647739 and sealed in the same batch. The initial creation event records its initial owner; the following OwnershipTransferred event establishes the sealed owner. The original log-only interpretation and corrected receipt analysis are both retained.

Concurrent-renewal transactions: `0x943a3935aa6ee6319d122fe68ca3323cafc3c86f2a25adba27557995bb9321c6` and `0x3a1b9132e5cd0abf27357b8806ac45d483dcfb11c8fedcec0e03e93147ce8f0b`. Both succeeded, each using 25,240 gas; neither added coverage beyond the shared absolute target.

## Remaining manual actions and limits

- The owner confirmed tools used, willingness for the feedback call (**Yes**) and **not yet submitted** on 16 October. The exact integration time remains unknown and an estimate has been requested. See [submission evidence](submission-evidence.md). No connected authenticated Devfolio session is available; submission requires explicit authorization. Optional attendance and other unresolved personal declarations remain for the team.
- An independent usability session has not happened. A separate participant is needed; no user feedback or adoption is invented.
- Public-RPC throttling can block future reads; all previously blocked phone and publication readbacks passed after its reset. A quota error is not evidence of empty or expired records. No alternate provider or real MetaMask/Rabby extension was tested. The account actions above do not block the implemented app or published artifacts.

## Per-file commits

All 122 commits below were verified to contain exactly one file. This handoff document is added in its own following commit; obtain that SHA with `git log -1 -- docs/final-handoff.md`. No older shared-history coauthor trailer was found.

| Commit | File | Message |
|---|---|---|
| [3df768e](https://github.com/TheWeirdDee/muniment/commit/3df768e877c2f0a7d218e90a971f422b4f306439) | `apps/web/src/components/RenewDialog.tsx` | Keep renewal results visible across record refreshes |
| [375a796](https://github.com/TheWeirdDee/muniment/commit/375a796844de60b8717bab7b5128f6e3f617900b) | `apps/web/src/lib/wallet.tsx` | Recognise wallet rejection through nested SDK errors |
| [00ed3c7](https://github.com/TheWeirdDee/muniment/commit/00ed3c76660e062b959830ba2b32d7f4e973b70c) | `apps/web/src/lib/live.ts` | Start fallback polling and reconcile WebSocket recovery |
| [2f2483c](https://github.com/TheWeirdDee/muniment/commit/2f2483c149b22a9e23b86489a9558de55a076c1a) | `reader/reader.html` | Keep standalone reader controls within narrow viewports |
| [1961cb6](https://github.com/TheWeirdDee/muniment/commit/1961cb601a3c2990c4b70a8a5dce250f2bd907ae) | `tests/e2e/live.spec.ts` | Verify rejected signatures retain their result and send nothing |
| [61b2702](https://github.com/TheWeirdDee/muniment/commit/61b27022e96828a541a4ba20a27e535a844b218f) | `tests/e2e/recovery.spec.ts` | Exercise record reconciliation after a browser network outage |
| [9ae4bb3](https://github.com/TheWeirdDee/muniment/commit/9ae4bb365832df785cc6669ed29e107842bfad8e) | `scripts/resilience.ts` | Probe concurrent absolute-target renewal on Tiramisu |
| [045d7f4](https://github.com/TheWeirdDee/muniment/commit/045d7f458583b5a74b50edae768e7f41e84a6103) | `scripts/visual-audit.mjs` | Audit routes across nine widths and both themes |
| [60873a5](https://github.com/TheWeirdDee/muniment/commit/60873a5fe07c547bb730e5b986c050d8444e3699) | `evidence/resilience-2026-10-16T08-24-14-631Z.json` | Preserve the failed exclusive-winner concurrency expectation |
| [62c67bb](https://github.com/TheWeirdDee/muniment/commit/62c67bba21d4871842d7f369573967c30902a8f1) | `evidence/resilience-2026-10-16T08-26-01-199Z.json` | Record accepted concurrent renewals without double coverage |
| [8c0033c](https://github.com/TheWeirdDee/muniment/commit/8c0033ca2b601addca5e2156138a38c66f0afbc6) | `MUNIMENT_PRD.md` | Publish the revised specification with confirmed track eligibility |
| [a4f57e8](https://github.com/TheWeirdDee/muniment/commit/a4f57e8164cb7ed442eec4c08db64921cce0510a) | `apps/web/src/styles/tokens.css` | Use the supplied palette for labelled status states |
| [3742f88](https://github.com/TheWeirdDee/muniment/commit/3742f88504ad93e7e0051b7265a1ee9f0b35fbcd) | `reader/reader.html` | Use palette colours and explicit status labels in the reader |
| [f1e0685](https://github.com/TheWeirdDee/muniment/commit/f1e06852491b18cc190967b6f81dd62b29ebf4a8) | `scripts/visual-audit.mjs` | Include record and dashboard layouts in responsive audits |
| [125c042](https://github.com/TheWeirdDee/muniment/commit/125c04263f267c5b81bbb28d9522c67cdf4ab262) | `reader/reader.html` | Wrap long reader footer links on narrow screens |
| [e57ca65](https://github.com/TheWeirdDee/muniment/commit/e57ca6506c8f94f8610eae382de2d5e9da1b80f6) | `apps/web/src/pages/Publish.tsx` | Keep confirmed publication links available when readback is delayed |
| [2aea763](https://github.com/TheWeirdDee/muniment/commit/2aea7639edde56bd61770d0cc06590ee9b33cc8c) | `tests/e2e/publish-live.spec.ts` | Verify production synthetic publication with a real test wallet |
| [565db4b](https://github.com/TheWeirdDee/muniment/commit/565db4b66e70f2f9d0b9ae6fb8fad0c22392396c) | `tests/e2e/publish-live.spec.ts` | Bound publication readback and retain confirmed transaction evidence |
| [7c2a196](https://github.com/TheWeirdDee/muniment/commit/7c2a1960fc67e38235e7d99ae35f787f1b0a83db) | `evidence/visual-audit/home-1024-dark-reduced.png` | Record home-1024-dark-reduced verification evidence |
| [63ff1bc](https://github.com/TheWeirdDee/muniment/commit/63ff1bccd2306784bf424cd44abd8f736d61343b) | `evidence/visual-audit/home-1024-light-reduced.png` | Record home-1024-light-reduced verification evidence |
| [3e391cf](https://github.com/TheWeirdDee/muniment/commit/3e391cf5380c13c93818e2279d8cf3cbcfc108b4) | `evidence/visual-audit/home-1280-dark-reduced.png` | Record home-1280-dark-reduced verification evidence |
| [69fe1ac](https://github.com/TheWeirdDee/muniment/commit/69fe1acf1d146dbe691c35b018c430b2deeca184) | `evidence/visual-audit/home-1280-light-reduced.png` | Record home-1280-light-reduced verification evidence |
| [1dc892f](https://github.com/TheWeirdDee/muniment/commit/1dc892f617e5354603982d1874d13af363700e6b) | `evidence/visual-audit/home-1440-dark-reduced.png` | Record home-1440-dark-reduced verification evidence |
| [8413bab](https://github.com/TheWeirdDee/muniment/commit/8413babeaaff9dc7fb7c7cafb4599e316bf85d1a) | `evidence/visual-audit/home-1440-light-reduced.png` | Record home-1440-light-reduced verification evidence |
| [1dffb12](https://github.com/TheWeirdDee/muniment/commit/1dffb1267d7d8e831ed2b94a913e704118eae83f) | `evidence/visual-audit/home-1920-dark-reduced.png` | Record home-1920-dark-reduced verification evidence |
| [66032d4](https://github.com/TheWeirdDee/muniment/commit/66032d483ebe9d8b95ea0535b976505d750f6bb8) | `evidence/visual-audit/home-1920-light-reduced.png` | Record home-1920-light-reduced verification evidence |
| [d473647](https://github.com/TheWeirdDee/muniment/commit/d473647b051ac45f53f5f329f8e4e937e0738a3c) | `evidence/visual-audit/home-320-dark-reduced.png` | Record home-320-dark-reduced verification evidence |
| [e438d68](https://github.com/TheWeirdDee/muniment/commit/e438d68c1a39952a8a8ab689a510e6e56b1b3098) | `evidence/visual-audit/home-320-light-reduced.png` | Record home-320-light-reduced verification evidence |
| [5c379ea](https://github.com/TheWeirdDee/muniment/commit/5c379eabe036caf4b03f389a366b09465fd516a9) | `evidence/visual-audit/home-360-dark-reduced.png` | Record home-360-dark-reduced verification evidence |
| [e961122](https://github.com/TheWeirdDee/muniment/commit/e961122844c017949fd97be89961202115535a98) | `evidence/visual-audit/home-360-light-reduced.png` | Record home-360-light-reduced verification evidence |
| [177f871](https://github.com/TheWeirdDee/muniment/commit/177f871f8ac7fd7f1c6bef4685803323c9d2a228) | `evidence/visual-audit/home-390-dark-reduced.png` | Record home-390-dark-reduced verification evidence |
| [0606c78](https://github.com/TheWeirdDee/muniment/commit/0606c78cc7ebbf35a9d96c09200da5a8dc0e367c) | `evidence/visual-audit/home-390-light-reduced.png` | Record home-390-light-reduced verification evidence |
| [1a76926](https://github.com/TheWeirdDee/muniment/commit/1a769268004d9cab2754f7566a5cb6cd084677b7) | `evidence/visual-audit/home-430-dark-reduced.png` | Record home-430-dark-reduced verification evidence |
| [a13ead4](https://github.com/TheWeirdDee/muniment/commit/a13ead4150a74684e901ee8c4aeb88c016d9be28) | `evidence/visual-audit/home-430-light-reduced.png` | Record home-430-light-reduced verification evidence |
| [b867279](https://github.com/TheWeirdDee/muniment/commit/b867279c78e46380cfed88d788e17961f573913d) | `evidence/visual-audit/home-768-dark-reduced.png` | Record home-768-dark-reduced verification evidence |
| [fea496c](https://github.com/TheWeirdDee/muniment/commit/fea496c7129ce8f2e5e5009cbb3a08689993d0e6) | `evidence/visual-audit/home-768-light-reduced.png` | Record home-768-light-reduced verification evidence |
| [80254dc](https://github.com/TheWeirdDee/muniment/commit/80254dc171c0de395217af560cc3a60c223bed40) | `evidence/visual-audit/motion/page@f8a1fe18b80f6c15f744053a7123a8e0.webm` | Record page@f8a1fe18b80f6c15f744053a7123a8e0 verification evidence |
| [5e4d9de](https://github.com/TheWeirdDee/muniment/commit/5e4d9de912e4d2570fc91484ffa98f58cfd9f322) | `evidence/visual-audit/results.json` | Record results verification evidence |
| [fc410c3](https://github.com/TheWeirdDee/muniment/commit/fc410c3f82387b12449c89d09d7b304ee6e1e3e8) | `evidence/visual-final/home-1024-dark-reduced.png` | Record home-1024-dark-reduced verification evidence |
| [4f68852](https://github.com/TheWeirdDee/muniment/commit/4f68852c12f9d364a843398b8840555c44fb6182) | `evidence/visual-final/home-1024-light-reduced.png` | Record home-1024-light-reduced verification evidence |
| [2b56ffc](https://github.com/TheWeirdDee/muniment/commit/2b56ffcd6f0f362220580c25203fe6d6dad71c97) | `evidence/visual-final/home-1280-dark-reduced.png` | Record home-1280-dark-reduced verification evidence |
| [410f624](https://github.com/TheWeirdDee/muniment/commit/410f6242802ff9a761124f9002241feebfece661) | `evidence/visual-final/home-1280-light-reduced.png` | Record home-1280-light-reduced verification evidence |
| [c8d1b36](https://github.com/TheWeirdDee/muniment/commit/c8d1b3619f1eeb6128ea02010b7f11ffe5bed820) | `evidence/visual-final/home-1440-dark-motion-fold.png` | Record home-1440-dark-motion-fold verification evidence |
| [3ad1bfb](https://github.com/TheWeirdDee/muniment/commit/3ad1bfbd605ed4f1e60613d911285ab4895db58f) | `evidence/visual-final/home-1440-dark-reduced.png` | Record home-1440-dark-reduced verification evidence |
| [ed7ff89](https://github.com/TheWeirdDee/muniment/commit/ed7ff8922847b32460dd24c5029d4fe2b0333ba6) | `evidence/visual-final/home-1440-light-reduced.png` | Record home-1440-light-reduced verification evidence |
| [7074e03](https://github.com/TheWeirdDee/muniment/commit/7074e033c43c848c694e2e4e52551141d5dcf5fe) | `evidence/visual-final/home-1920-dark-reduced.png` | Record home-1920-dark-reduced verification evidence |
| [ba858a2](https://github.com/TheWeirdDee/muniment/commit/ba858a20bc421660ff1fe8da332787e8f18f3bfc) | `evidence/visual-final/home-1920-light-reduced.png` | Record home-1920-light-reduced verification evidence |
| [cde5fd7](https://github.com/TheWeirdDee/muniment/commit/cde5fd74e21c58b97c628be73345150f0c9b0032) | `evidence/visual-final/home-320-dark-reduced.png` | Record home-320-dark-reduced verification evidence |
| [778a495](https://github.com/TheWeirdDee/muniment/commit/778a4956b3fba957b0c8a02c6aefe273037cd336) | `evidence/visual-final/home-320-light-reduced.png` | Record home-320-light-reduced verification evidence |
| [8ba56e9](https://github.com/TheWeirdDee/muniment/commit/8ba56e94e6ee9ea24b7fd354a814c2118ec44c47) | `evidence/visual-final/home-360-dark-reduced.png` | Record home-360-dark-reduced verification evidence |
| [0346b53](https://github.com/TheWeirdDee/muniment/commit/0346b534903b9b107e507e4a0b22ba9a2299ccb9) | `evidence/visual-final/home-360-light-reduced.png` | Record home-360-light-reduced verification evidence |
| [a0201bf](https://github.com/TheWeirdDee/muniment/commit/a0201bf5f62776e83ee1a2245ab520096fff1779) | `evidence/visual-final/home-390-dark-reduced.png` | Record home-390-dark-reduced verification evidence |
| [2560fb7](https://github.com/TheWeirdDee/muniment/commit/2560fb7e26264da03ce52255f334aa0608d12f7d) | `evidence/visual-final/home-390-light-reduced.png` | Record home-390-light-reduced verification evidence |
| [a01d937](https://github.com/TheWeirdDee/muniment/commit/a01d93781df2922d915d2dae700f618c70925f63) | `evidence/visual-final/home-430-dark-reduced.png` | Record home-430-dark-reduced verification evidence |
| [337e82a](https://github.com/TheWeirdDee/muniment/commit/337e82a033fd4b92e15ee70b7a8cc0a14be9caff) | `evidence/visual-final/home-430-light-reduced.png` | Record home-430-light-reduced verification evidence |
| [9d23a76](https://github.com/TheWeirdDee/muniment/commit/9d23a7643cbe17de98e69333d385d41e1bad09ea) | `evidence/visual-final/home-768-dark-reduced.png` | Record home-768-dark-reduced verification evidence |
| [451e435](https://github.com/TheWeirdDee/muniment/commit/451e43577fc2945b53beccfc0ce6f78f4d7261f3) | `evidence/visual-final/home-768-light-reduced.png` | Record home-768-light-reduced verification evidence |
| [2d65378](https://github.com/TheWeirdDee/muniment/commit/2d65378605473407883f6b32fb7936d378c13e6c) | `evidence/visual-final/motion/page@854557e84b2646fd97a338f3e62a296d.webm` | Record page@854557e84b2646fd97a338f3e62a296d verification evidence |
| [1017bfb](https://github.com/TheWeirdDee/muniment/commit/1017bfbd6c2c7a67b02fe9dab1b59dd6533455e1) | `evidence/visual-final/results.json` | Record results verification evidence |
| [ebdaa08](https://github.com/TheWeirdDee/muniment/commit/ebdaa08e176973efc40a40719905ca6ad18a6433) | `evidence/reader-final/reader-1440-dark.png` | Record reader-1440-dark verification evidence |
| [fd099c1](https://github.com/TheWeirdDee/muniment/commit/fd099c1bb7cf2539d7c3435344dd50abee0bb3f3) | `evidence/reader-final/reader-1440-light.png` | Record reader-1440-light verification evidence |
| [e96ff1f](https://github.com/TheWeirdDee/muniment/commit/e96ff1f9c5b23cff66baef7a47b331fbf5a8b8b7) | `evidence/reader-final/reader-320-dark.png` | Record reader-320-dark verification evidence |
| [6f36092](https://github.com/TheWeirdDee/muniment/commit/6f36092013caa204a11f234b2a9936f9dedd2437) | `evidence/reader-final/reader-320-light.png` | Record reader-320-light verification evidence |
| [a849691](https://github.com/TheWeirdDee/muniment/commit/a849691a397c3e9e7c48cf8be25273645b88d699) | `evidence/reader-final/reader-390-dark.png` | Record reader-390-dark verification evidence |
| [b1b650f](https://github.com/TheWeirdDee/muniment/commit/b1b650f6fd3c5d905e666ec217893663413aa898) | `evidence/reader-final/reader-390-light.png` | Record reader-390-light verification evidence |
| [9820100](https://github.com/TheWeirdDee/muniment/commit/98201001057e4194f06318aed9003d5b1889e664) | `evidence/reader-final/results.json` | Record results verification evidence |
| [9d4a89a](https://github.com/TheWeirdDee/muniment/commit/9d4a89ab60a5ff4fe7561d423fbd2cc9e02410b8) | `evidence/reference-tablet/primary-768-scrolled.png` | Record primary-768-scrolled verification evidence |
| [66e0b24](https://github.com/TheWeirdDee/muniment/commit/66e0b24b68894bf622019148d7b3d0f8753bfa30) | `evidence/reference-tablet/primary-768.png` | Record primary-768 verification evidence |
| [ee559f6](https://github.com/TheWeirdDee/muniment/commit/ee559f63c7029569d1b317033d1eafab3fbf83d2) | `evidence/reference-tablet/secondary-768-scrolled.png` | Record secondary-768-scrolled verification evidence |
| [0390cb0](https://github.com/TheWeirdDee/muniment/commit/0390cb0dfaabd61cd8711fd347a1cb786f92f7f2) | `evidence/reference-tablet/secondary-768.png` | Record secondary-768 verification evidence |
| [7fa3f73](https://github.com/TheWeirdDee/muniment/commit/7fa3f73bbca1ffada2a4f8e10f5b1e93837532b2) | `evidence/final-chain.json` | Record final-chain verification evidence |
| [3d686bb](https://github.com/TheWeirdDee/muniment/commit/3d686bbf139a6ad857264f57f783393aebdbeb25) | `evidence/chain-handoff.json` | Record chain-handoff verification evidence |
| [75f9449](https://github.com/TheWeirdDee/muniment/commit/75f94491de8cf4e8d8b311b4f8eca79a2337f229) | `evidence/ui-publication-recovery.json` | Record ui-publication-recovery verification evidence |
| [4abd6d7](https://github.com/TheWeirdDee/muniment/commit/4abd6d7d9646f9677f3dde7cb6f01d52c253f23e) | `evidence/ui-publication-confirmed.json` | Record ui-publication-confirmed verification evidence |
| [da1c3bf](https://github.com/TheWeirdDee/muniment/commit/da1c3bf84e416f05b6570456418e348b58c9caa0) | `evidence/release-check.json` | Record release-check verification evidence |
| [2895e3a](https://github.com/TheWeirdDee/muniment/commit/2895e3a330e78f3aff5b7e94228d9cecaab70a16) | `evidence/production-verification.json` | Record production-verification verification evidence |
| [fd984df](https://github.com/TheWeirdDee/muniment/commit/fd984df98e494ffcc886bfdbbcf365f888abf09a) | `evidence/e2e-results.json` | Record e2e-results verification evidence |
| [ad87dbd](https://github.com/TheWeirdDee/muniment/commit/ad87dbd558601cfe897d66512f912838f3d07a15) | `evidence/screens/after/archive-1440-dark-fold.png` | Record archive-1440-dark-fold verification evidence |
| [d56bbfd](https://github.com/TheWeirdDee/muniment/commit/d56bbfd5e4e0aa46584347cfa58bf7f49fdc5029) | `evidence/screens/after/archive-1440-dark.png` | Record archive-1440-dark verification evidence |
| [13ab6b7](https://github.com/TheWeirdDee/muniment/commit/13ab6b729921acfe5d49e8ccd43e52996e593228) | `evidence/screens/after/archive-390-dark-fold.png` | Record archive-390-dark-fold verification evidence |
| [6da11ed](https://github.com/TheWeirdDee/muniment/commit/6da11edef28c35bf96bc90f146da3117064b4af0) | `evidence/screens/after/archive-390-dark.png` | Record archive-390-dark verification evidence |
| [c5bdbf1](https://github.com/TheWeirdDee/muniment/commit/c5bdbf13998f9219808dc5241413e9064a3e4193) | `evidence/screens/after/home-1440-dark-fold.png` | Record home-1440-dark-fold verification evidence |
| [94ff84d](https://github.com/TheWeirdDee/muniment/commit/94ff84db23d3f2782ba5239bb4cc4a04a93fddcf) | `evidence/screens/after/home-1440-dark.png` | Record home-1440-dark verification evidence |
| [8179145](https://github.com/TheWeirdDee/muniment/commit/817914580a9b9dca841264bb93e509b2376b410d) | `evidence/screens/after/home-390-dark-fold.png` | Record home-390-dark-fold verification evidence |
| [3839eec](https://github.com/TheWeirdDee/muniment/commit/3839eec51e280877bed785ce8621060842dced21) | `evidence/screens/after/home-390-dark.png` | Record home-390-dark verification evidence |
| [59668d8](https://github.com/TheWeirdDee/muniment/commit/59668d868ea883bfc29f295aea0f6618f8b67b43) | `evidence/screens/after/preserve-1440-dark-fold.png` | Record preserve-1440-dark-fold verification evidence |
| [046e628](https://github.com/TheWeirdDee/muniment/commit/046e6283b935f20ae085853348ebbc879a587710) | `evidence/screens/after/preserve-1440-dark.png` | Record preserve-1440-dark verification evidence |
| [c06a074](https://github.com/TheWeirdDee/muniment/commit/c06a074f5d1fa2b9af5065946523c8ab1b369d8a) | `evidence/screens/after/preserve-390-dark-fold.png` | Record preserve-390-dark-fold verification evidence |
| [b854010](https://github.com/TheWeirdDee/muniment/commit/b854010faa08bac4fad91555ff342ff99a8600fa) | `evidence/screens/after/preserve-390-dark.png` | Record preserve-390-dark verification evidence |
| [c91574f](https://github.com/TheWeirdDee/muniment/commit/c91574f01274e9a58a8efa00e9dbf5df69c415f4) | `evidence/screens/after/records-0x40060682792bd0e9d66ae426a6db78365d3ee2c03ab85ea64f02f650304cc529-1440-dark-fold.png` | Record records-0x40060682792bd0e9d66ae426a6db78365d3ee2c03ab85ea64f02f650304cc529-1440-dark-fold verification evidence |
| [5e6a13f](https://github.com/TheWeirdDee/muniment/commit/5e6a13ff28aec4bc9c0be5bac5403a2af8624810) | `evidence/screens/after/records-0x40060682792bd0e9d66ae426a6db78365d3ee2c03ab85ea64f02f650304cc529-1440-dark.png` | Record records-0x40060682792bd0e9d66ae426a6db78365d3ee2c03ab85ea64f02f650304cc529-1440-dark verification evidence |
| [352870a](https://github.com/TheWeirdDee/muniment/commit/352870a4fbf2c7c0c4963aef93bf531b41a0fcaf) | `evidence/screens/after/records-0x40060682792bd0e9d66ae426a6db78365d3ee2c03ab85ea64f02f650304cc529-390-dark-fold.png` | Record records-0x40060682792bd0e9d66ae426a6db78365d3ee2c03ab85ea64f02f650304cc529-390-dark-fold verification evidence |
| [5b9039f](https://github.com/TheWeirdDee/muniment/commit/5b9039fa13d3a927be9f17c1969b6ffb9bae9026) | `evidence/screens/after/records-0x40060682792bd0e9d66ae426a6db78365d3ee2c03ab85ea64f02f650304cc529-390-dark.png` | Record records-0x40060682792bd0e9d66ae426a6db78365d3ee2c03ab85ea64f02f650304cc529-390-dark verification evidence |
| [030cbe0](https://github.com/TheWeirdDee/muniment/commit/030cbe086707898adb6e76241dfa3a1c34ba9953) | `docs/testing.md` | Update testing with production verification and limits |
| [9861b61](https://github.com/TheWeirdDee/muniment/commit/9861b6183d8e8bd0db8fc3dd85f86e3415281af7) | `docs/requirements-checklist.md` | Update requirements-checklist with production verification and limits |
| [0fda53e](https://github.com/TheWeirdDee/muniment/commit/0fda53e6898a80a536b446b9e1820dadc120196f) | `docs/submission.md` | Update submission with production verification and limits |
| [d464d02](https://github.com/TheWeirdDee/muniment/commit/d464d02123a45550807cab662b2abdec490eca96) | `docs/design-reference-notes.md` | Update design-reference-notes with production verification and limits |
| [235f729](https://github.com/TheWeirdDee/muniment/commit/235f729bd6428dfbd3309e6cc5b9d2aa2334a49c) | `docs/deployment.md` | Update deployment with production verification and limits |
| [12d7ce0](https://github.com/TheWeirdDee/muniment/commit/12d7ce08aa82a68b13035b27aaf0095eddc593a2) | `arkiv/friction.md` | Update friction with production verification and limits |
| [1e8d4d0](https://github.com/TheWeirdDee/muniment/commit/1e8d4d0696687ede17e26edcfd4cc7af58b7287e) | `apps/dashboard/index.html` | Distinguish fictional source records from measured live dashboard summaries |
| [cdd8d1b](https://github.com/TheWeirdDee/muniment/commit/cdd8d1b8e82b37c6805cb2c42b054e0a13a94969) | `apps/dashboard/src/styles.css` | Use Eggshell text and labelled palette-only dashboard errors |
| [4fcb9a9](https://github.com/TheWeirdDee/muniment/commit/4fcb9a9b953d01204f41af1c60038c047c3356eb) | `apps/web/vercel.json` | Apply the standalone reader policy to its clean URL |
| [09b9edc](https://github.com/TheWeirdDee/muniment/commit/09b9edc41c6d05f35b8155a98ea76638c1e598d9) | `tests/e2e/site.spec.ts` | Check hosted reader initialization after the clean URL redirect |
| [55a167a](https://github.com/TheWeirdDee/muniment/commit/55a167ad296c0123ede0a4e346c88b80cbdcde09) | `tests/e2e/publish-live.spec.ts` | Read back the already-published production record without another write |
| [b455429](https://github.com/TheWeirdDee/muniment/commit/b455429640972feb41e9b064035ed655d3ad0acf) | `evidence/release-check.json` | Verify Git-linked deployment revisions and public release downloads |
| [bfa88f0](https://github.com/TheWeirdDee/muniment/commit/bfa88f0456f2dd513f06f3918bd012b09a1d0bab) | `evidence/hosted-reader-dashboard.json` | Record working hosted reader controls and final dashboard copy |
| [1fdfc8a](https://github.com/TheWeirdDee/muniment/commit/1fdfc8a1e0531da062eb1592c47adc4a121edde4) | `evidence/reader-hosted-working.png` | Capture the initialised hosted reader at 320 pixels |
| [7ef6b27](https://github.com/TheWeirdDee/muniment/commit/7ef6b27b27c04af7330ca6fad1b1cdbf13d6f2c4) | `evidence/dashboard-final-320.png` | Capture the corrected dashboard at 320 pixels |
| [a03c76b](https://github.com/TheWeirdDee/muniment/commit/a03c76bab9db80ce1a21adb06b3d0db39c4fe22b) | `evidence/reader-debug.png` | Retain the local reader layout diagnostic capture |
| [0ef96ba](https://github.com/TheWeirdDee/muniment/commit/0ef96ba2532c4366ca858b27f0301ab7ad000f74) | `docs/testing.md` | Record passing hosted reader regressions on desktop and phone |
| [daafc31](https://github.com/TheWeirdDee/muniment/commit/daafc3194b7af6188e7ec80c675c012c18346b42) | `docs/copy-audit.md` | Document dashboard scope and confirmed-publication copy corrections |
| [1817779](https://github.com/TheWeirdDee/muniment/commit/1817779e2e9e27e5d86e8674b5e3599781b3accc) | `apps/web/src/styles/base.css` | Remove global horizontal overflow clipping after bounded-layout verification |
| [1b7395e](https://github.com/TheWeirdDee/muniment/commit/1b7395ebc7e04f832a5004e7a13355534cfce2c5) | `evidence/unclipped-layout.json` | Record 180 passing layout checks with page overflow clipping disabled |
| [2950c67](https://github.com/TheWeirdDee/muniment/commit/2950c67ed70c51b612846116d177ec316ddcbad1) | `docs/testing.md` | Document responsive checks without global page clipping |
| [8b3cf6b](https://github.com/TheWeirdDee/muniment/commit/8b3cf6b6fa6825cd3e725c3459a34dbdb888bbcf) | `tests/e2e/live.spec.ts` | Verify network switching and stale quote guards before signing |
| [56eefeb](https://github.com/TheWeirdDee/muniment/commit/56eefebc9c4ae1247c208502bb86d9c660c700e6) | `evidence/phone-live-rerun.json` | Record ten passing phone live checks after the query quota reset |
| [783e478](https://github.com/TheWeirdDee/muniment/commit/783e4782cdc155d9b3e9cf2afc9a702e6e008ae7) | `evidence/missing-record-rerun.json` | Record the passing phone missing-record rerun |
| [997bbe4](https://github.com/TheWeirdDee/muniment/commit/997bbe4d5b5fa9fde3af2eddca6b2c6a1d102b83) | `evidence/remaining-readbacks.json` | Record production publication readback on desktop and phone |
| [9f92806](https://github.com/TheWeirdDee/muniment/commit/9f92806fdc42755214cbf94e59fe6b35b95ab699) | `evidence/ui-publication-readback.json` | Read back the existing sealed synthetic publication after throttling |
| [d4438ee](https://github.com/TheWeirdDee/muniment/commit/d4438ee87393804d3051af5b775a2aaa7a585c0b) | `docs/testing.md` | Record resolved quota failures and passing signing guard checks |
| [66b6aa4](https://github.com/TheWeirdDee/muniment/commit/66b6aa4294fe7645b0a4ff0dbbad43d26584161a) | `docs/submission.md` | Update submission verification with completed production readbacks |
| [c9926f2](https://github.com/TheWeirdDee/muniment/commit/c9926f281b7d0bae6d555abcbe4767709164b58e) | `docs/requirements-checklist.md` | Reconcile requirements with the completed phone reruns |
