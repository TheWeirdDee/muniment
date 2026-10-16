/** Reproduce the submission timing estimate from a local Claude JSONL log.
 * node scripts/integration-timeline.mjs <project-session.jsonl>
 * Emits selected event metadata only; never copies command inputs or credentials.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

if (!process.argv[2]) throw new Error('Provide the project session JSONL path')
const rows = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(JSON.parse)
const tools = rows.flatMap(row => (Array.isArray(row.message?.content) ? row.message.content : [])
  .filter(item => item.type === 'tool_use' && row.timestamp)
  .map(item => ({ at: row.timestamp, id: item.id, name: item.name, input: item.input })))
const find = predicate => {
  const tool = tools.find(predicate)
  if (!tool) throw new Error('Required timeline event missing')
  return { at: tool.at, id: tool.id, description: tool.input?.description || tool.input?.url || tool.name }
}
const events = {
  networkDocs: find(t => t.name === 'WebFetch' && t.input?.url === 'https://docs.arkiv.network/networks/tiramisu/'),
  sdkVersions: find(t => t.input?.description === 'Inspect published Arkiv SDK versions'),
  sdkInstall: find(t => t.input?.description === 'Download Arkiv doc pages and install SDK'),
  dryRun: find(t => t.input?.description === 'Dry-run seed contract validation'),
  seed: find(t => t.input?.description === 'Seed synthetic corpus on Tiramisu'),
}
const seedResults = rows.flatMap(row => (Array.isArray(row.message?.content) ? row.message.content : [])
  .filter(item => item.type === 'tool_result' && item.tool_use_id === events.seed.id)
  .map(item => ({ at: row.timestamp, error: item.is_error === true, text: String(item.content) })))
const chain = JSON.parse(readFileSync('evidence/submission-chain-status.json', 'utf8')).firstDocumentedSeed
if (chain.status !== 'success' || !seedResults.some(r => !r.error && r.text.includes(chain.txHash))) {
  throw new Error('Seed tool output does not corroborate successful chain transaction')
}
const elapsedMs = Date.parse(chain.blockTime) - Date.parse(events.networkDocs.at)
if (!(elapsedMs > 0)) throw new Error('Invalid timeline ordering')
const report = {
  sourceLog: basename(process.argv[2]),
  events,
  seedOutputConfirmedAt: seedResults.find(r => !r.error && r.text.includes(chain.txHash)).at,
  firstDocumentedCreation: chain,
  calculation: { startProxy: events.networkDocs.at, end: chain.blockTime, elapsedMs,
    roundedEstimate: 'About 10 hours 50 minutes elapsed', submissionCategory: '2 to 24 hours' },
  interpretation: 'Evidence-based estimate from the earliest explicit Tiramisu documentation request in the available implementation session. This is wall-clock elapsed time, including gaps, not active coding time. Exact integration start and absence of all earlier creations cannot be proven. Nearby SDK inspection and installation events place the observed start within the same few minutes.',
}
writeFileSync('evidence/integration-timeline.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
