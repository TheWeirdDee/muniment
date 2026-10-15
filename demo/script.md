# Demo film script (≈2:45)

Recorded from the production site with `scripts/record-demo.ts` (Playwright video, on-screen captions, synthesized narration). Every transaction shown is real and is listed in the closing frame and in the scene log written next to the video. Waiting periods are cut and marked "(wait shortened)".

| # | Time | On screen | Narration |
|---|---|---|---|
| 1 | 0:00–0:18 | Landing hero with a live record card | An illustrative scenario: a reporter needs a government reply after the portal that held it changed. Every record here is synthetic test data on Arkiv's testnet. |
| 2 | 0:18–0:42 | Archive filtered to refused replies; open a record; the provenance panel | She searches refused replies. Each filter is an Arkiv query on typed attributes. The record shows the claimed authority separately from the wallet that uploaded it. Preserved is not the same as authenticated. |
| 3 | 0:42–0:58 | Save to a collection; the collections page | She saves related replies to a collection. That is a bookmark in her browser, not a transaction. |
| 4 | 0:58–1:25 | Renew storage: plan, estimated cost, sign with a different wallet, confirmed, new expiry read back, receipt verified | A different wallet renews storage. The dialog shows the plan and an estimated fee in test GLM, then each real stage: submitted, confirmed, the new expiry read back from Arkiv, and the receipt verified against the transaction. |
| 5 | 1:25–1:40 | Proof evidence: the owner-only control rejects the stranger; sealed delete rejected | Strangers can renew but never edit. Our proof run shows the same wallet rejected on an owner-only control, and even the publisher unable to delete a sealed record. |
| 6 | 1:40–2:08 | Standalone reader opened from disk, main site blocked, same key read | Now block the Muniment website entirely. A single HTML file, opened from disk, reads the same record straight from Arkiv. It still needs an Arkiv endpoint; it is not offline. |
| 7 | 2:08–2:28 | The separate dashboard on another origin | A separately hosted dashboard charts response times from the same public contract, with denominators and missing values shown. |
| 8 | 2:28–2:45 | Closing frame: repository, evidence, limits | Arkiv gives typed queries, expiry, permissionless extension, immutable creators and atomic batches. Renewal is not permanence. Evidence and reproduction steps are in the repository. |

## Captions

Captions are the narration text, shown as on-screen text in the lower third. An `.srt` file is written alongside the video.
