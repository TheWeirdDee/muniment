/**
 * Publish the synthetic corpus to Arkiv Tiramisu.
 *
 *   node --env-file=.env --import tsx scripts/seed.ts [--dry-run] [--force]
 *
 * Replies, their exemption relations and appeals land in one atomic batch per group. Sealed records
 * have ownership handed to 0x…dEaD in the same batch, so no wallet (including the publisher) can
 * delete or transfer them; anyone can still extend them. Reviews are written by the REVIEWER wallet.
 * The manifest of every entity and transaction is written to evidence/manifest.json.
 */
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk"
import { i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { APP, SCHEMA_VERSION, SEAL_ADDRESS, type Hex, decodeReply, fromSdkEntity } from "muniment-query"
import { buildCorpus, sourceFixture, type CorpusReply } from "./corpus.js"
import { ROOT, address, errorText, publicClient, wallet } from "./lib.js"

const REPO_BLOB = process.env.MUNIMENT_REPO_BLOB || "https://github.com/TheWeirdDee/muniment/blob/main"
const DRY = process.argv.includes("--dry-run")
const FORCE = process.argv.includes("--force")
const MANIFEST = join(ROOT, "evidence", "manifest.json")
const DISCLOSURE = "Synthetic test record published for the Muniment hackathon demo on the Arkiv Tiramisu testnet. Not a real government reply."

type ManifestEntry = { id: string; kind: string; key: Hex; txHash: string; expiresAt: string; sealed: boolean; reply?: string; creator: string }

const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const reference = (r: CorpusReply) => `${r.authority.prefix}/RTI/${r.filed.slice(0, 4)}/${r.id.toUpperCase()}`

function replyCreate(r: CorpusReply, salt: bigint, correctsKey: Hex | null) {
  const attributes: Record<string, unknown> = {
    app: str(APP),
    schema: i32(SCHEMA_VERSION),
    kind: str("reply"),
    synthetic: true,
    authority: str(r.authority.slug),
    jurisdiction: str(r.authority.jurisdiction),
    topic: str(r.topic),
    outcome: str(r.outcome),
    language: str("en"),
    filed_ms: u64(ms(r.filed)),
    ref: str(reference(r)),
  }
  if (r.replied) {
    attributes.replied_ms = u64(ms(r.replied))
    attributes.response_days = i32(Math.round((ms(r.replied) - ms(r.filed)) / 86_400_000))
  }
  if (r.exemptions[0]) attributes.exemption = str(r.exemptions[0])
  if (correctsKey) attributes.corrects = key(correctsKey)
  const payload = {
    schema: "muniment.reply/1",
    synthetic: true,
    title: r.title,
    question: r.question,
    answer: r.answer,
    authorityName: r.authority.name,
    jurisdictionName: r.authority.jurisdictionName,
    claimedSource: {
      reference: reference(r),
      url: r.sourceUrl ? `${REPO_BLOB}/corpus/sources/${r.id}.md` : null,
      documentDate: r.replied,
      status: r.sourceUrl ? "url-claimed" : "synthetic-no-source",
    },
    attachment: null,
    exemptions: r.exemptions,
    correction: correctsKey && r.corrects ? { of: correctsKey, reason: r.corrects.reason } : null,
    disclosure: DISCLOSURE,
  }
  return {
    payload: jsonToPayload(payload),
    contentType: "application/json" as const,
    attributes: attributes as never,
    expires: ExpirationTime.fromDays(r.lifetimeDays),
    flags: { readonly: true, permissionlessExtension: true },
    salt,
  }
}

async function main() {
  const corpus = buildCorpus()
  mkdirSync(join(ROOT, "corpus", "sources"), { recursive: true })
  for (const r of corpus) writeFileSync(join(ROOT, "corpus", "sources", `${r.id}.md`), sourceFixture(r))
  // Validate every reply payload against the contract before spending anything.
  for (const r of corpus) {
    const c = replyCreate(r, 1n, r.corrects ? (`0x${"0".repeat(63)}1` as Hex) : null)
    const raw = fromSdkEntity({
      key: `0x${"0".repeat(64)}` as Hex,
      payload: c.payload,
      contentType: c.contentType,
      attributes: Object.fromEntries(Object.entries(c.attributes as Record<string, unknown>).map(([n, v]) => [n, typeof v === "boolean" ? { type: "bool", value: v } : (v as { type: string; value: unknown })])),
    })
    const d = decodeReply(raw)
    if (!d.ok) throw new Error(`corpus ${r.id} fails the contract: ${d.issue.reason}`)
  }
  console.log(`Corpus: ${corpus.length} replies, ${corpus.reduce((n, r) => n + r.appeals.length, 0)} appeals, ${corpus.reduce((n, r) => n + r.exemptions.length, 0)} exemption relations, ${corpus.filter((r) => r.review).length} reviews. Contract check passed.`)
  if (DRY) return

  if (existsSync(MANIFEST) && !FORCE) {
    const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as { entries: ManifestEntry[] }
    const live = await publicClient.query(`app = str('${APP}') AND kind = str('reply') AND $creator = addr(${address("PUBLISHER")})`, { select: { key: true }, limit: 200 })
    if (live.entities.length > 0) {
      console.log(`Manifest exists with ${m.entries.length} entries and ${live.entities.length} live replies. Use --force to publish a second copy.`)
      return
    }
  }

  const pub = wallet("PUBLISHER")
  const entries: ManifestEntry[] = []
  const keyOf = new Map<string, Hex>()
  const groups: CorpusReply[][] = []
  const ordered = [...corpus.filter((r) => !r.corrects), ...corpus.filter((r) => r.corrects)]
  for (let i = 0; i < ordered.length; i += 4) groups.push(ordered.slice(i, i + 4))

  for (const [gi, group] of groups.entries()) {
    const count = group.reduce((n, r) => n + 1 + r.exemptions.length + r.appeals.length, 0)
    const predicted = await publicClient.predictEntityKeys({ owner: address("PUBLISHER"), count })
    let p = 0
    const creates: ReturnType<typeof replyCreate>[] = []
    const meta: { id: string; kind: string; reply?: string; sealed: boolean }[] = []
    const seal: Hex[] = []
    for (const r of group) {
      const correctsKey = r.corrects ? keyOf.get(r.corrects.id) ?? null : null
      if (r.corrects && !correctsKey) throw new Error(`correction target ${r.corrects.id} not yet published`)
      const replyPred = predicted[p++]
      creates.push(replyCreate(r, replyPred.salt, correctsKey))
      meta.push({ id: r.id, kind: "reply", sealed: r.sealed })
      if (r.sealed) seal.push(replyPred.key)
      for (const section of r.exemptions) {
        const pr = predicted[p++]
        creates.push({
          payload: new Uint8Array(),
          contentType: "application/octet-stream" as never,
          attributes: { app: str(APP), schema: i32(SCHEMA_VERSION), kind: str("exemption"), reply: key(replyPred.key), section: str(section) } as never,
          expires: ExpirationTime.fromDays(r.lifetimeDays),
          flags: { readonly: true, permissionlessExtension: true },
          salt: pr.salt,
        })
        meta.push({ id: `${r.id}:exemption:${section}`, kind: "exemption", reply: r.id, sealed: r.sealed })
        if (r.sealed) seal.push(pr.key)
      }
      for (const [ai, a] of r.appeals.entries()) {
        const pr = predicted[p++]
        creates.push({
          payload: jsonToPayload({ schema: "muniment.appeal/1", synthetic: true, grounds: a.grounds, decision: a.decision, disclosure: DISCLOSURE }),
          contentType: "application/json",
          attributes: { app: str(APP), schema: i32(SCHEMA_VERSION), kind: str("appeal"), reply: key(replyPred.key), stage: str(a.stage), filed_ms: u64(ms(a.filed)), outcome: str(a.outcome) } as never,
          // Same relative lifetime in the same transaction = the same expiry block as the parent.
          expires: ExpirationTime.fromDays(r.lifetimeDays),
          flags: { readonly: true, permissionlessExtension: true },
          salt: pr.salt,
        })
        meta.push({ id: `${r.id}:appeal:${ai}`, kind: "appeal", reply: r.id, sealed: r.sealed })
        if (r.sealed) seal.push(pr.key)
      }
    }
    let res
    try {
      res = await pub.executeBatch({ creates, ownershipChanges: seal.map((k) => ({ entityKey: k, newOwner: SEAL_ADDRESS })) })
    } catch (err) {
      console.error(`group ${gi} failed: ${errorText(err)}`)
      throw err
    }
    const keys = res.createdEntities as Hex[]
    for (const [i, k] of keys.entries()) {
      if (k !== predicted[i].key) throw new Error(`group ${gi}: key ${i} differs from prediction; another write from this wallet landed first`)
      const e = await publicClient.getEntity(k)
      entries.push({ ...meta[i], key: k, txHash: res.txHash, expiresAt: e.expiresAt.toString(), creator: e.creator })
      if (meta[i].kind === "reply") keyOf.set(meta[i].id, k)
    }
    console.log(`group ${gi + 1}/${groups.length}: ${keys.length} entities, sealed ${seal.length}, tx ${res.txHash}`)
  }

  const rev = wallet("REVIEWER")
  const reviewed = corpus.filter((r) => r.review)
  const res = await rev.executeBatch({
    creates: reviewed.map((r) => ({
      payload: jsonToPayload({
        schema: "muniment.review/1",
        method: r.review!.method,
        limitations: r.review!.limitations,
        evidenceRef: `${REPO_BLOB}/corpus/sources/${r.id}.md`,
        observedAt: new Date().toISOString().slice(0, 10),
      }),
      contentType: "application/json",
      attributes: { app: str(APP), schema: i32(SCHEMA_VERSION), kind: str("review"), reply: key(keyOf.get(r.id)!), status: str(r.review!.status) } as never,
      expires: ExpirationTime.fromDays(365),
      flags: { readonly: true, permissionlessExtension: true },
    })),
  })
  for (const [i, k] of (res.createdEntities as Hex[]).entries()) {
    const e = await publicClient.getEntity(k)
    entries.push({ id: `${reviewed[i].id}:review`, kind: "review", reply: reviewed[i].id, key: k, txHash: res.txHash, expiresAt: e.expiresAt.toString(), sealed: false, creator: e.creator })
  }
  console.log(`reviews: ${res.createdEntities.length}, tx ${res.txHash}`)

  const head = await publicClient.getBlockNumber()
  writeFileSync(
    MANIFEST,
    `${JSON.stringify({ network: "tiramisu", chainId: 7738577, publishedAtBlock: head.toString(), publishedAt: new Date().toISOString(), publisher: address("PUBLISHER"), reviewer: address("REVIEWER"), sealAddress: SEAL_ADDRESS, entries }, null, 2)}\n`,
  )
  console.log(`Manifest written: ${entries.length} entities.`)
}

main().catch((err) => {
  console.error(errorText(err))
  process.exit(1)
})
