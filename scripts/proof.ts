/**
 * Live proof campaign against Arkiv Tiramisu. Creates clearly labelled synthetic CONTROL entities
 * (kind = "control", never shown as archive records) and checks the permission, atomicity,
 * attribution and expiry properties Muniment's claims depend on.
 *
 *   node --env-file=.env --import tsx scripts/proof.ts [--skip-expiry]
 *
 * Requires funded PUBLISHER, RENEWER and STRANGER wallets. Writes evidence/proof-<timestamp>.json.
 */
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk"
import { i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import { decodeReceipt, fromSdkEntity, SEAL_ADDRESS, verifyRenewalReceipt, type Hex } from "muniment-query"
import { Evidence, address, errorText, poll, publicClient, sleep, wallet } from "./lib.js"

const ev = new Evidence("proof")
const RUN = `run-${Date.now()}`
const skipExpiry = process.argv.includes("--skip-expiry")

const pub = wallet("PUBLISHER")
const ren = wallet("RENEWER")
const str_ = wallet("STRANGER")

const controlAttrs = (label: string) => ({
  app: str("muniment-archive"),
  schema: i32(1),
  kind: str("control"),
  synthetic: true,
  label: str(label),
  run: str(RUN),
})

const payload = (label: string) =>
  jsonToPayload({ synthetic: true, control: label, note: "Muniment proof-campaign control entity. Not an archive record." })

async function expiryOf(k: Hex): Promise<bigint | null> {
  try {
    return (await publicClient.getEntity(k)).expiresAt
  } catch {
    return null
  }
}

async function expectFailure(fn: () => Promise<unknown>): Promise<{ failed: boolean; message: string; txHash?: string }> {
  try {
    const r = (await fn()) as { txHash?: string }
    return { failed: false, message: "succeeded", txHash: r?.txHash }
  } catch (err) {
    return { failed: true, message: errorText(err), txHash: (err as { txHash?: string }).txHash }
  }
}

async function main() {
  const head0 = await publicClient.getBlockNumber()
  console.log(`Proof run ${RUN} at block ${head0}`)
  console.log(`publisher ${address("PUBLISHER")}\nrenewer   ${address("RENEWER")}\nstranger  ${address("STRANGER")}\n`)

  // ---- P1: create controls with documented flags --------------------------------------------
  const [predA, predB, predS] = await publicClient.predictEntityKeys({ owner: address("PUBLISHER"), count: 3 })
  const created = await pub.executeBatch({
    creates: [
      { payload: payload("A"), contentType: "application/json", attributes: controlAttrs("A-readonly-permissionless"), expires: ExpirationTime.fromHours(6), flags: { readonly: true, permissionlessExtension: true }, salt: predA.salt },
      { payload: payload("B"), contentType: "application/json", attributes: controlAttrs("B-readonly-owner-only"), expires: ExpirationTime.fromHours(6), flags: { readonly: true, permissionlessExtension: false }, salt: predB.salt },
      { payload: payload("S"), contentType: "application/json", attributes: controlAttrs("S-sealed"), expires: ExpirationTime.fromHours(6), flags: { readonly: true, permissionlessExtension: true }, salt: predS.salt },
    ],
    ownershipChanges: [{ entityKey: predS.key, newOwner: SEAL_ADDRESS }],
  })
  const [A, B, S] = created.createdEntities as Hex[]
  const eA = await publicClient.getEntity(A)
  const eB = await publicClient.getEntity(B)
  const eS = await publicClient.getEntity(S)
  ev.record({
    id: "P1",
    title: "Create controls with readonly / permissionlessExtension flags, one sealed to the 0x…dEaD burn address in the same batch",
    expected: "A flags {readonly, permissionless}; B {readonly}; S owner = 0x…dEaD, creator = publisher; predicted keys match",
    observed: `A ${JSON.stringify(eA.creationFlags)}; B ${JSON.stringify(eB.creationFlags)}; S owner ${eS.owner} creator ${eS.creator}; predicted match ${A === predA.key && B === predB.key && S === predS.key}`,
    outcome:
      eA.creationFlags.readonly && eA.creationFlags.permissionlessExtension && eB.creationFlags.readonly && !eB.creationFlags.permissionlessExtension &&
      eS.owner.toLowerCase() === SEAL_ADDRESS.toLowerCase() && eS.creator.toLowerCase() === address("PUBLISHER").toLowerCase() && A === predA.key
        ? "pass"
        : "fail",
    txHashes: [created.txHash],
    entityKeys: [A, B, S],
  })

  // ---- P2: stranger extension succeeds on A, fails on comparable B ---------------------------
  const before = await expiryOf(A)
  const extA = await ren.extendEntity({ entityKey: A, expires: ExpirationTime.fromHours(12) })
  const afterA = await expiryOf(A)
  ev.record({
    id: "P2a",
    title: "A different wallet extends a permissionless-extension entity",
    expected: "transaction succeeds; direct read shows a later $expiresAt; owner unchanged",
    observed: `before ${before}, reported ${extA.expiresAt}, read back ${afterA}`,
    outcome: afterA !== null && before !== null && afterA > before && afterA === extA.expiresAt ? "pass" : "fail",
    txHashes: [extA.txHash],
    entityKeys: [A],
  })
  const bBefore = await expiryOf(B)
  const extB = await expectFailure(() => ren.extendEntity({ entityKey: B, expires: ExpirationTime.fromHours(12) }))
  const bAfter = await expiryOf(B)
  ev.record({
    id: "P2b",
    title: "The same wallet cannot extend an otherwise comparable entity without the flag",
    expected: "rejected (NotOwner); expiry unchanged",
    observed: `${extB.message}; expiry ${bBefore} -> ${bAfter}`,
    outcome: extB.failed && bBefore === bAfter ? "pass" : "fail",
    txHashes: extB.txHash ? [extB.txHash] : [],
    entityKeys: [B],
  })

  // ---- P3: mutation attempts -----------------------------------------------------------------
  const strangerPatch = await expectFailure(() => str_.patchEntity({ entityKey: A, set: { label: str("tampered") } }))
  ev.record({ id: "P3a", title: "Stranger patch on a readonly entity", expected: "rejected", observed: strangerPatch.message, outcome: strangerPatch.failed ? "pass" : "fail", entityKeys: [A] })
  const ownerPatch = await expectFailure(() => pub.patchEntity({ entityKey: A, set: { label: str("tampered") } }))
  ev.record({ id: "P3b", title: "Owner patch on a readonly entity", expected: "rejected (ReadOnlyEntity)", observed: ownerPatch.message, outcome: ownerPatch.failed ? "pass" : "fail", entityKeys: [A] })
  const strangerDelete = await expectFailure(() => str_.deleteEntity({ entityKey: A }))
  ev.record({ id: "P3c", title: "Stranger delete", expected: "rejected (NotOwner)", observed: strangerDelete.message, outcome: strangerDelete.failed ? "pass" : "fail", entityKeys: [A] })
  const sealedDelete = await expectFailure(() => pub.deleteEntity({ entityKey: S }))
  const sAlive = (await expiryOf(S)) !== null
  ev.record({
    id: "P3d",
    title: "Original publisher cannot delete a sealed entity",
    expected: "rejected (NotOwner); entity still readable",
    observed: `${sealedDelete.message}; still readable: ${sAlive}`,
    outcome: sealedDelete.failed && sAlive ? "pass" : "fail",
    entityKeys: [S],
  })
  const sealedExtend = await ren.extendEntity({ entityKey: S, expires: ExpirationTime.fromHours(12) })
  ev.record({
    id: "P3e",
    title: "A stranger can still extend a sealed permissionless entity",
    expected: "succeeds",
    observed: `expiresAt ${sealedExtend.expiresAt}`,
    outcome: (await expiryOf(S)) === sealedExtend.expiresAt ? "pass" : "fail",
    txHashes: [sealedExtend.txHash],
    entityKeys: [S],
  })

  // Owner escape paths on an unsealed record: transfer, then the new owner deletes.
  const transfer = await pub.changeOwnership({ entityKey: B, newOwner: address("STRANGER") })
  const newOwnerDelete = await expectFailure(() => str_.deleteEntity({ entityKey: B }))
  const bGone = (await expiryOf(B)) === null
  ev.record({
    id: "P3f",
    title: "Escape path on an UNSEALED readonly entity: owner transfers, new owner deletes",
    expected: "both succeed — readonly does not prevent deletion; this is why archive records are sealed",
    observed: `transfer ${transfer.txHash}; delete ${newOwnerDelete.message}; gone ${bGone}`,
    outcome: !newOwnerDelete.failed && bGone ? "pass" : "fail",
    txHashes: [transfer.txHash, ...(newOwnerDelete.txHash ? [newOwnerDelete.txHash] : [])],
    entityKeys: [B],
  })

  // ---- P4: atomicity -------------------------------------------------------------------------
  const head = await publicClient.getBlockNumber()
  const target = head + 60n * 60n * 10n
  const aExp = await expiryOf(A)
  // A batch that renews A and writes a receipt, plus an extension of the deleted B, which must fail.
  // Explicit gas skips pre-flight estimation so the transaction is mined and reverts on chain.
  const atomic = await expectFailure(() =>
    ren.executeBatch(
      {
        creates: [
          {
            payload: jsonToPayload({ schema: "muniment.receipt/1", note: "atomic-failure control", extendedCount: 2 }),
            contentType: "application/json",
            attributes: { app: str("muniment-archive"), schema: i32(1), kind: str("control"), label: str("receipt-in-failed-batch"), run: str(RUN), reply: key(A), target_expiry: u64(target) },
            expires: ExpirationTime.atBlock(target),
            flags: { readonly: true, permissionlessExtension: false },
          },
        ],
        extensions: [
          { entityKey: A, expires: ExpirationTime.atBlock(target) },
          { entityKey: B, expires: ExpirationTime.atBlock(target) },
        ],
      },
      { gas: 2_000_000n },
    ),
  )
  const aExpAfter = await expiryOf(A)
  const receipts = await publicClient.query(`app = str('muniment-archive') AND kind = str('control') AND run = str('${RUN}') AND label = str('receipt-in-failed-batch')`, { select: { key: true }, limit: 5 })
  ev.record({
    id: "P4a",
    title: "Deliberate atomic failure: valid extension + receipt create + invalid extension in one batch",
    expected: "transaction reverts on chain; A's expiry unchanged; no receipt entity exists",
    observed: `${atomic.message}; A expiry ${aExp} -> ${aExpAfter}; receipts found ${receipts.entities.length}`,
    outcome: atomic.failed && aExp === aExpAfter && receipts.entities.length === 0 ? "pass" : "fail",
    txHashes: atomic.txHash ? [atomic.txHash] : [],
    entityKeys: [A],
  })

  // ---- P5: verified renewal vs forged claim ---------------------------------------------------
  const target2 = target + 600n
  const good = await ren.executeBatch({
    creates: [
      {
        payload: jsonToPayload({ schema: "muniment.receipt/1", note: "proof: genuine", extendedCount: 1 }),
        contentType: "application/json",
        attributes: { app: str("muniment-archive"), schema: i32(1), kind: str("receipt"), reply: key(A), target_expiry: u64(target2), run: str(RUN) },
        expires: ExpirationTime.atBlock(target2),
        flags: { readonly: true, permissionlessExtension: false },
      },
    ],
    extensions: [{ entityKey: A, expires: ExpirationTime.atBlock(target2) }],
  })
  const forged = await str_.createEntity({
    payload: jsonToPayload({ schema: "muniment.receipt/1", note: "proof: forged", extendedCount: 1 }),
    contentType: "application/json",
    attributes: { app: str("muniment-archive"), schema: i32(1), kind: str("receipt"), reply: key(A), target_expiry: u64(target2), run: str(RUN) },
    expires: ExpirationTime.fromHours(6),
    flags: { readonly: true, permissionlessExtension: false },
  })
  const claims = await publicClient.query(`app = str('muniment-archive') AND schema = i32(1) AND kind = str('receipt') AND run = str('${RUN}')`, {
    select: { key: true, creator: true, owner: true, createdAt: true, expiresAt: true, creationFlags: true, contentType: true, payload: true, attributes: true },
    limit: 10,
  })
  const verdicts: Record<string, string> = {}
  for (const raw of claims.entities) {
    const d = decodeReceipt(fromSdkEntity(raw as never))
    if (!d.ok) continue
    const v = await verifyRenewalReceipt(publicClient as never, d.value)
    verdicts[d.value.key] = v.state === "verified" ? `verified renewer ${v.renewer}` : `${v.state}: ${v.reason}`
  }
  const goodKey = good.createdEntities[0]
  ev.record({
    id: "P5",
    title: "Genuine renewal receipt verifies; standalone forged receipt is excluded",
    expected: "genuine = verified (renewer = RENEWER); forged = unverified",
    observed: JSON.stringify(verdicts),
    outcome: verdicts[goodKey]?.startsWith("verified") && verdicts[forged.entityKey]?.startsWith("unverified") ? "pass" : "fail",
    txHashes: [good.txHash, forged.txHash],
    entityKeys: [goodKey, forged.entityKey],
  })

  // ---- P6: never shorten ------------------------------------------------------------------------
  const shorten = await expectFailure(() => ren.extendEntity({ entityKey: A, expires: ExpirationTime.atBlock(target2 - 100n) }))
  ev.record({ id: "P6", title: "Extension to an earlier block", expected: "rejected (ExpiryNotExtended) before or on chain", observed: shorten.message, outcome: shorten.failed ? "pass" : "fail", entityKeys: [A] })

  // ---- P7: native GLM transfer between wallets ---------------------------------------------------
  try {
    const hash = await pub.sendTransaction({ to: address("REVIEWER"), value: 1_000_000_000_000_000n })
    const rcpt = await publicClient.waitForTransactionReceipt({ hash })
    ev.record({ id: "P7", title: "Plain GLM value transfer between EOAs", expected: "documented: only Arkiv operation address accepted", observed: `status ${rcpt.status}`, outcome: rcpt.status === "success" ? "pass" : "unsupported", txHashes: [hash] })
  } catch (err) {
    ev.record({ id: "P7", title: "Plain GLM value transfer between EOAs", expected: "documented: only Arkiv operation address accepted", observed: errorText(err), outcome: "unsupported" })
  }

  // ---- P8: short-lived control actually expires ---------------------------------------------------
  if (!skipExpiry) {
    const short = await pub.createEntity({
      payload: payload("short"),
      contentType: "application/json",
      attributes: controlAttrs("short-lived-expiry-control"),
      expires: ExpirationTime.fromBlocks(45),
      flags: { readonly: true, permissionlessExtension: false },
    })
    const seen = await publicClient.getEntity(short.entityKey)
    const seenAt = await publicClient.getBlockNumber()
    console.log(`short-lived control ${short.entityKey} expires at ${short.expiresAt}; observed at ${seenAt}. Waiting…`)
    const gone = await poll(async () => {
      const h = await publicClient.getBlockNumber()
      if (h < short.expiresAt) return null
      try {
        await publicClient.getEntity(short.entityKey)
        return null
      } catch (err) {
        return { head: h, error: errorText(err) }
      }
    }, { timeoutMs: 6 * 60_000, startMs: 4000, maxMs: 8000 })
    const q = await publicClient.query(`$key = key(${short.entityKey})`, { select: { key: true }, limit: 1 })
    ev.record({
      id: "P8",
      title: "Short-lived synthetic control observed live, then observed gone after its expiry block",
      expected: "prior observation recorded; after head >= expiresAt, getEntity throws and query returns nothing",
      observed: gone
        ? `observed live at block ${seenAt} (expires ${seen.expiresAt}); gone at head ${gone.head}: ${gone.error}; query results ${q.entities.length}`
        : "did not disappear within 6 minutes",
      outcome: gone && q.entities.length === 0 ? "pass" : "fail",
      txHashes: [short.txHash],
      entityKeys: [short.entityKey],
    })
  }

  await sleep(10)
  ev.save({ run: RUN, startBlock: head0.toString() })
}

main().catch((err) => {
  console.error(err)
  ev.record({ id: "ABORT", title: "Campaign aborted", expected: "complete run", observed: errorText(err), outcome: "fail" })
  ev.save({ run: RUN, aborted: true })
  process.exit(1)
})
