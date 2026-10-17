# Submission declarations and supporting evidence

Declarations dated 16 October 2026 list Claude Code, OpenAI Codex and ChatGPT usage, confirm availability for the 20-minute feedback call, and report that Muniment had not yet been submitted. No entry was submitted or account modified during this verification. The AI-use declaration and supporting model identifiers are retained for the hackathon's required disclosure.

## Integration time

**Evidence-based estimate: about 10 hours 50 minutes elapsed; submission category: 2 to 24 hours.** The exact first integration action is not established. This estimate uses recorded implementation events and the first documented successful creation transaction.

All following times are 15 October 2026 UTC:

| Event | Time | Evidence |
|---|---|---|
| Initial workspace inspection returns only the PRD | 11:34:00 | Implementation-session tool-result log; no implementation files listed |
| Tiramisu network documentation requested | 11:34:58.486 | WebFetch event; chosen observed start proxy |
| Arkiv SDK versions investigated | 11:34:59.675 | Terminal tool event |
| SDK documentation/install work invoked | 11:35:50.534 | Terminal tool event |
| Seed dry-run invoked; contract validation passes | 12:04:30; result 12:04:54 | Terminal tool/result events; dry run creates no entities |
| Real seed invoked | 22:24:57.881 | Terminal tool event |
| First documented seed transaction succeeds | 22:25:08 | Tiramisu receipt and block timestamp |
| Seed output confirms transaction and 80 total entities | 22:26:39 | Terminal tool-result log |

Subtracting the observed documentation request from the first creation gives **10 hours 50 minutes 9.514 seconds**. The seconds are reproducible timestamp arithmetic, not a claim that the true integration start is known that precisely. Nearby SDK events differ by under a minute; the broad 2-to-24-hour category is supported by the available implementation timeline. Gaps between sessions are included; no active-work duration or cause of the gaps is inferred.

Git's README-only initial commit is dated 11:34:33 UTC, consistent with this early session, but it is not used as an integration-start timestamp. Implementation commits were recorded after the seed. An unrelated 15 October session contains no Muniment/Arkiv/Tiramisu references and is excluded. The project-specific implementation log begins with workspace inspection and PRD reading before network documentation and SDK setup.

The first seed transaction listed in `evidence/manifest.json` has a successful receipt at block `626671`, timestamp **15 October 2026, 22:25:08 UTC**. Its hash matches the first group in the successful seed terminal output. The manifest's `publishedAt` at 22:26:37 UTC is completion metadata, not the first transaction timestamp. No earlier successful creation was identified in the inspected implementation log; this is not a chain-wide proof of absence. The earlier dry run only validated the corpus. The estimate is labelled as such in the submission draft.

Selected event evidence and calculation: [integration-timeline.json](../evidence/integration-timeline.json). Reproduce using `node scripts/integration-timeline.mjs <project-session.jsonl>`; the parser accepts a local Claude Code JSONL export, checks the logged seed transaction against the recorded chain receipt and publishes only selected metadata.

Public transaction and deployed-version checks: [submission-chain-status.json](../evidence/submission-chain-status.json).

All eight checked public app, reader, repository, schema/friction and release-asset URLs returned HTTP 200 at 19:36 UTC on 16 October ([link report](../evidence/submission-link-status.json)). This establishes availability at that checkpoint only; both apps then served the earlier revision. The package regression rerun passed all 51 tests across eight files at 19:34 UTC. Subsequent deployments and signed results are recorded in [the 17 October campaign](transaction-campaign-2026-10-17.md).

## Models and tools

Project-matching local session metadata confirms `claude-opus-5-5` and `gpt-6.1-sol`. ChatGPT involvement is owner-confirmed; its underlying model remains unknown. Internal `codex-auto-review` metadata describes approval infrastructure, not a claimed coding model. The `<synthetic>` log marker is not treated as a model.

[submission-session-metadata.json](../evidence/submission-session-metadata.json) contains only selected timestamps, log basenames and model identifiers, not conversation contents or credentials. Available logs are not a complete model or tool history. Runtime dependencies and testing tools are recorded in manifests/lockfile and `THIRD_PARTY_NOTICES.md`; demo recording, Windows speech synthesis and FFmpeg are evidenced by `scripts/record-demo.ts`, `scripts/demo-narration.ps1` and `scripts/mux-demo.mjs`.

## Submission status verification

The declaration records **not yet submitted** on 16 October; no authenticated Devfolio dashboard state or submission receipt has been independently verified. Before submission, verify the project entry, roster/eligibility, Censorship Resistance and Open Source track selections, every required answer, app/repository/demo URLs and the deployed revision. Retain the actual submission confirmation/receipt and final dashboard status. A prepared draft or public project page is not proof of submission.

Canonical rules and required questions were rechecked on 16 October: [rules](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/RULES.md), [checklist](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/submission-checklist.md). Deadline: 18 October 2026, 22:59 UTC (23:59 Lagos). The historical `2d:3h:26m` dashboard countdown has no established capture timestamp and is not used to derive a deadline.
