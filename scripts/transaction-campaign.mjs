import { chromium, expect } from "@playwright/test";
import { createPublicClient as arkivClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { createPublicClient, decodeAbiParameters, decodeEventLog, decodeFunctionData, hexToString, parseAbi, parseAbiParameters } from "viem";
import { ARKIV_ADDRESS, SEAL_ADDRESS, TIRAMISU, decodeReceipt, decodeReply, fromSdkEntity, politeHttp } from "muniment-query";
import { injectTestWallet } from "../tests/e2e/wallet.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const base = "https://muniment-archive.vercel.app";
const revision = process.env.MUNIMENT_EXPECTED_COMMIT || "f1e69505409dcaf383928d9a114c9b458d00a3d8";
const file = ".release/transaction-campaign.json";
const report = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { startedAt: new Date().toISOString(), runtimeRevision: revision, chainId: 7738577, signingMethod: "Deployed UI -> EIP-1193/EIP-6963 isolated test wallet -> explicit scoped automated approval -> locally signed real Tiramisu transaction", workflows: { publication: {}, single: {}, multi: {} }, attempts: [] };
if (process.env.E2E_RETENTION_REPEAT === "1" && !report.workflows.multi.retentionRepeat) {
    insist(report.workflows.multi.status === "PASS", "Complete the initial campaign before a retention repeat");
    for (const stage of Object.values(report.workflows))
        stage.runtimeRevision ??= report.runtimeRevision;
    report.priorMulti = [...(report.priorMulti || []), report.workflows.multi];
    report.workflows.multi = { retentionRepeat: true, preferredSecond: report.workflows.multi.secondReply, runtimeRevision: revision };
    report.runtimeRevision = revision;
}
const save = () => writeFileSync(file, JSON.stringify(report, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2) + "\n");
const transport = () => politeHttp(TIRAMISU.httpRpc, { concurrency: 1, attempts: 4, maxWaitMs: 90000, totalTimeoutMs: 120000 });
const rpc = createPublicClient({ chain: tiramisu, transport: transport() });
const db = arkivClient({ chain: tiramisu, transport: transport() });
const abi = parseAbi(["function execute((uint8 operation,bytes operationData)[] ops) returns (bytes32[] keys)"]);
const events = parseAbi(["event EntityCreated(bytes32 indexed entityKey,address indexed owner,uint64 expiresAt,uint8 creationFlags)", "event ExpiryExtended(bytes32 indexed entityKey,address indexed owner,uint64 expiresAt)"]);
const createParams = parseAbiParameters("(uint128 salt,uint64 expiresAt,uint64 minLifetime,uint8 creationFlags,(bytes32 name,uint8 typeId,bytes value)[] attributes)");
const extendParams = parseAbiParameters("(bytes32 entityKey,uint64 expiresAt,uint64 minLifetime)");
const transferParams = parseAbiParameters("(bytes32 entityKey,address newOwner)");
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
function insist(value, message) { if (!value)
    throw Error(message); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function retry(fn, attempts = 4) { let error; for (let i = 0; i < attempts; i++) {
    try {
        return await fn();
    }
    catch (e) {
        error = e;
        if (i + 1 < attempts)
            await sleep(1800 * (i + 1));
    }
} throw error; }
function decodedLogs(receipt) { return receipt.logs.filter((l) => same(l.address, ARKIV_ADDRESS)).flatMap((l) => { try {
    return [decodeEventLog({ abi: events, topics: l.topics, data: l.data })];
}
catch {
    return [];
} }); }
async function versions() { const list = []; for (const origin of [base, "https://muniment-insights.vercel.app"]) {
    const r = await fetch(origin + "/version.json?campaign=" + Date.now(), { signal: AbortSignal.timeout(20000) });
    const v = await r.json();
    list.push({ origin, status: r.status, ...v });
    insist(r.ok && v.commit === revision, "Deployment not at requested revision: " + origin);
} report.deployments = list; save(); }
async function receipt(stage) { insist(stage.txHash, "No submitted transaction checkpoint"); const r = await rpc.waitForTransactionReceipt({ hash: stage.txHash, timeout: 120000 }); insist(r.status === "success", "Transaction reverted: " + stage.txHash); stage.block = String(r.blockNumber); stage.receiptStatus = r.status; stage.explorer = TIRAMISU.explorer + "/tx/" + stage.txHash; const b = await rpc.getBlock({ blockNumber: r.blockNumber }); stage.blockTime = new Date(Number(b.timestamp) * 1000).toISOString(); save(); return r; }
let browser;
async function signer(role, stage) {
    const key = process.env[role + "_KEY"];
    insist(key, "Missing locally configured test signer");
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
    page.setDefaultTimeout(60000);
    const wallet = await injectTestWallet(page, { key, approve: async (tx) => {
            try {
                stage.approvalRequestedAt = new Date().toISOString();
                save();
                insist(stage.armed && !stage.txHash, "No approval armed, or transaction already sent");
                insist(new URL(page.url()).origin === base, "Approval must originate at the deployed archive");
                insist(await rpc.getChainId() === 7738577, "Wrong chain");
                insist(same(tx.to, ARKIV_ADDRESS) && (!tx.value || BigInt(tx.value) === 0n), "Unexpected recipient/value");
                const decoded = decodeFunctionData({ abi, data: tx.data });
                const ops = decoded.args[0];
                if (stage.action === "publication") {
                    insist(new URL(page.url()).pathname === "/publish", "Publication not initiated from deployed form");
                    insist(ops.length === 2 && ops[0].operation === 1 && ops[1].operation === 4, "Expected one create and one sealing transfer");
                    const [c] = decodeAbiParameters(createParams, ops[0].operationData);
                    insist(c.creationFlags === 3 && c.minLifetime === 302400n, "Expected seven-day readonly permissionless record");
                    const attributes = new Map(c.attributes.map(a => [hexToString(a.name, { size: 32 }), a.value]));
                    insist(hexToString(attributes.get("kind")) === "reply", "Expected reply creation");
                    const payload = JSON.parse(hexToString(attributes.get("$payload")));
                    insist(payload.synthetic === true && payload.title.includes("Signed campaign amber"), "Expected campaign synthetic payload");
                    const [t] = decodeAbiParameters(transferParams, ops[1].operationData);
                    insist(same(t.newOwner, SEAL_ADDRESS), "Expected sealing owner");
                    stage.predictedKey = t.entityKey;
                }
                else {
                    insist(stage.review?.entities?.length > 0, "Reviewed entity set missing");
                    insist(ops.every(op => op.operation === 1 || op.operation === 3), "Renewal contains unexpected operations");
                    const extensions = ops.filter(op => op.operation === 3).map(op => decodeAbiParameters(extendParams, op.operationData)[0]);
                    insist(extensions.length === stage.review.entities.length, "Extension count differs from reviewed plan");
                    for (const planned of stage.review.entities)
                        insist(extensions.filter(x => same(x.entityKey, planned.key) && x.expiresAt === BigInt(planned.target) && x.minLifetime === 0n).length === 1, "Calldata differs from reviewed key/target");
                    const creates = ops.filter(op => op.operation === 1).map(op => decodeAbiParameters(createParams, op.operationData)[0]);
                    insist(creates.length === stage.review.replies.length, "Expected one receipt per reviewed reply");
                    for (const reply of stage.review.replies) {
                        const matches = creates.filter(c => { const attrs = new Map(c.attributes.map(a => [hexToString(a.name, { size: 32 }), a.value])); return attrs.get("reply") && same(attrs.get("reply"), reply); });
                        insist(matches.length === 1, "Expected unique receipt for each reply");
                        insist(matches[0].expiresAt === BigInt(stage.review.target), "Receipt expiry differs from target");
                    }
                }
                const price = await rpc.getGasPrice(), gas = tx.gas ? BigInt(tx.gas) : await rpc.estimateGas({ account: stage.wallet, to: tx.to, data: tx.data });
                insist(gas * price < 10000000000000000n, "Campaign fee limit exceeds 0.01 test GLM");
                stage.approval = { at: new Date().toISOString(), url: page.url(), method: "Scoped automated test-wallet approval after deployed UI Sign click", chainId: 7738577, to: tx.to, gas: String(gas), gasPrice: String(price), estimatedMaxFee: String(gas * price), operationCount: ops.length };
                save();
                return true;
            }
            catch (error) {
                stage.approvalFailure = { at: new Date().toISOString(), reason: error instanceof Error ? error.message : String(error) };
                save();
                throw error;
            }
        }, onSubmitted: hash => { stage.txHash = hash; stage.armed = false; stage.submittedAt = new Date().toISOString(); save(); console.log(stage.action + " submitted " + hash); } });
    stage.wallet = wallet.address;
    stage.signerRole = role;
    save();
    return { page, context, wallet };
}
async function anyWallet(page) {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Network settings", exact: true }).click();
    await page.getByLabel(/Show records from any wallet that uses Muniment/).check();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
}
async function capturePlan(page, stage) {
    const dialog = page.getByRole("dialog", { name: /Renew storage/ });
    const included = dialog.getByLabel("Included entities", { exact: true });
    await expect(included).toBeVisible({ timeout: 90000 });
    stage.review = await included.evaluate(el => ({
        replies: Array.from(el.querySelectorAll('a[href^="/records/"]')).map(a => a.getAttribute("href").split("/").at(-1)),
        entities: Array.from(el.querySelectorAll("li")).map(li => { const match = /Current expiry: block ([\d,]+)\. Target expiry: block ([\d,]+)/.exec(li.textContent); return { key: li.querySelector(".hash").textContent, reply: li.parentElement.parentElement.querySelector('a[href^="/records/"]').getAttribute("href").split("/").at(-1), kind: li.querySelector("strong").textContent, before: match[1].replaceAll(",", ""), target: match[2].replaceAll(",", "") }; }),
    }));
    stage.review.target = stage.review.entities[0].target;
    for (const entity of stage.review.entities) {
        const actual = await retry(() => db.getEntity(entity.key));
        insist(actual.expiresAt === BigInt(entity.before), "Expiry moved before signing; re-quote required");
    }
    stage.reviewCapturedAt = new Date().toISOString();
    await page.screenshot({ path: `.release/${stage.action}-review.png`, fullPage: true });
    save();
    return dialog;
}
async function waitForUI(page, stage) {
    const dialog = page.getByRole("dialog", { name: /Renew storage/ });
    for (let attempt = 0; attempt < 8; attempt++) {
        const failed = dialog.locator(".notice-danger");
        if (await failed.count())
            throw Error(await failed.innerText());
        if (await dialog.getByText("Verified renewal", { exact: true }).count())
            break;
        const recheck = dialog.getByRole("button", { name: "Recheck confirmed transaction (no signature)" });
        if (await recheck.count() && await recheck.first().isEnabled())
            await recheck.first().click();
        await sleep(3500);
    }
    await expect(dialog.getByText("Verified renewal", { exact: true })).toBeVisible({ timeout: 90000 });
    stage.uiReconciliation = await dialog.locator('[aria-label="Transaction progress"]').innerText();
    await page.screenshot({ path: `.release/${stage.action}-verified.png`, fullPage: true });
    stage.uiVerifiedAt = new Date().toISOString();
    save();
}
async function independentRenewal(stage) {
    const r = await receipt(stage), logs = decodedLogs(r);
    insist(same(r.from, stage.wallet), "Wrong transaction sender");
    const extensions = logs.filter(e => e.eventName === "ExpiryExtended").map(e => e.args);
    const created = logs.filter(e => e.eventName === "EntityCreated").map(e => e.args);
    insist(created.length === stage.review.replies.length && extensions.length === stage.review.entities.length, "Confirmed event coverage differs from reviewed batch");
    const receipts = [];
    for (const c of created) {
        const raw = await retry(() => db.getEntity(c.entityKey));
        const decoded = decodeReceipt(fromSdkEntity(raw));
        insist(decoded.ok, "Created receipt failed decoding");
        const claim = decoded.value;
        insist(stage.review.replies.some((key) => same(key, claim.reply)), "Receipt names unreviewed reply");
        insist(claim.creator && same(claim.creator, stage.wallet) && claim.createdAtBlock === r.blockNumber && claim.targetExpiry === BigInt(stage.review.target), "Receipt creator, block or target mismatch");
        insist(c.expiresAt === BigInt(stage.review.target) && claim.payload?.extendedCount === stage.review.entities.filter((e) => same(e.reply, claim.reply)).length, "Receipt creation expiry or extended count mismatch");
        receipts.push({ key: claim.key, reply: claim.reply, creator: claim.creator, createdAtBlock: String(claim.createdAtBlock), target: String(claim.targetExpiry), extendedCount: claim.payload?.extendedCount, status: "PASS" });
    }
    for (const reply of stage.review.replies)
        insist(receipts.filter(c => same(c.reply, reply)).length === 1, "Reply lacks exactly one corresponding receipt");
    const entities = [];
    for (const item of stage.review.entities) {
        const matched = extensions.filter(e => same(e.entityKey, item.key));
        insist(matched.length === 1 && matched[0].expiresAt === BigInt(item.target), "Entity extension event target mismatch");
        const after = await retry(() => db.getEntity(item.key));
        insist(after.expiresAt >= BigInt(item.target) && after.expiresAt > BigInt(item.before), "Entity expiry did not increase to target");
        entities.push({ ...item, after: String(after.expiresAt), eventExpiry: String(matched[0].expiresAt), status: "PASS" });
    }
    stage.independent = { receipts, entities, checkedAt: new Date().toISOString(), method: "Separate Node RPC receipt/event decoding and fresh entity reads; does not call app reconciliation" };
    save();
}
async function readerCheck(key, tag) {
    const context = await browser.newContext(), page = await context.newPage();
    page.setDefaultTimeout(60000);
    await context.route(base + "/**", route => route.abort());
    await page.goto(pathToFileURL(resolve("reader/reader.html")).href);
    await page.locator("#key").fill(key);
    await page.getByRole("button", { name: "Read record", exact: true }).click();
    await expect(page.locator("#detail")).toContainText(key, { timeout: 90000 });
    const text = await page.locator("#detail").innerText();
    const actual = await retry(() => db.getEntity(key));
    insist(text.includes(actual.expiresAt.toLocaleString("en-GB")) || text.includes(String(actual.expiresAt)), "Reader does not show current RPC expiry");
    await page.screenshot({ path: `.release/${tag}-disk-reader.png`, fullPage: true });
    await context.close();
    return { key, status: "PASS", websiteBlocked: true, expiry: String(actual.expiresAt), text, checkedAt: new Date().toISOString() };
}
async function main() {
    insist(process.env.E2E_REAL_CAMPAIGN === "1", "Set E2E_REAL_CAMPAIGN=1 only after explicit authorization for real testnet writes");
    report.status = "RUNNING";
    save();
    insist(await rpc.getChainId() === 7738577, "Wrong network");
    await versions();
    browser = await chromium.launch();
    const pub = report.workflows.publication;
    pub.action = "publication";
    if (pub.status !== "PASS") {
        if (!pub.txHash) {
            const { page, context, wallet } = await signer("STRANGER", pub);
            await page.goto(base + "/publish");
            await page.getByLabel(/Title note/).fill("Signed campaign amber");
            await page.getByLabel("Initial lifetime", { exact: true }).selectOption("7");
            await page.getByLabel(/I understand this publishes a synthetic test record publicly/).check();
            await page.getByRole("button", { name: "Connect a wallet to publish", exact: true }).click();
            pub.armed = true;
            save();
            await page.getByRole("button", { name: "Sign and publish", exact: true }).click();
            await expect(page.getByRole("link", { name: "Open the record", exact: true })).toBeVisible({ timeout: 120000 });
            pub.key = (await page.getByRole("link", { name: "Open the record", exact: true }).getAttribute("href")).split("/").at(-1);
            pub.uiConfirmed = true;
            insist(wallet.sent.length === 1, "Expected one publication request");
            save();
            await page.screenshot({ path: ".release/publication-confirmed.png", fullPage: true });
            await context.close();
        }
        const pr = await receipt(pub), pcreated = decodedLogs(pr).filter(e => e.eventName === "EntityCreated");
        insist(pcreated.length === 1, "Expected one publication entity");
        pub.key = pub.key || pcreated[0].args.entityKey;
        const raw = await retry(() => db.getEntity(pub.key)), parsed = decodeReply(fromSdkEntity(raw));
        insist(parsed.ok, "Published reply failed schema decoding");
        insist(raw.creationFlags.readonly && raw.creationFlags.permissionlessExtension && same(raw.owner, SEAL_ADDRESS) && same(raw.creator, pub.wallet), "Publication identity/flags/seal mismatch");
        const firstExpiry = pcreated[0].args.expiresAt;
        insist(firstExpiry - pr.blockNumber === 302400n, "Initial storage is not seven nominal days");
        pub.independent = { key: pub.key, creator: raw.creator, owner: raw.owner, createdAtBlock: String(pr.blockNumber), initialExpiry: String(firstExpiry), flags: raw.creationFlags, title: parsed.value.payload.title, status: "PASS" };
        save();
        const readContext = await browser.newContext(), readPage = await readContext.newPage();
        readPage.setDefaultTimeout(60000);
        await readPage.goto(base + "/archive");
        await anyWallet(readPage);
        await expect(readPage.locator(".reply-row").first()).toBeVisible({ timeout: 90000 });
        for (let i = 0; i < 5 && !await readPage.locator(`.reply-row a[href="/records/${pub.key}"]`).count(); i++) {
            const more = readPage.getByRole("button", { name: /Load more/ });
            if (!await more.count() || !await more.isEnabled())
                break;
            const previous = await readPage.locator(".reply-row").count();
            await more.click();
            await expect.poll(() => readPage.locator(".reply-row").count(), { timeout: 90000 }).toBeGreaterThan(previous);
        }
        await expect(readPage.locator(`.reply-row a[href="/records/${pub.key}"]`).first()).toBeVisible({ timeout: 90000 });
        pub.archive = { status: "PASS", url: base + "/archive", trustMode: "Explicit any-wallet setting; untrusted publisher labelled" };
        await readPage.screenshot({ path: ".release/publication-archive.png", fullPage: true });
        await readContext.close();
        pub.reader = await readerCheck(pub.key, "publication");
        pub.status = "PASS";
        save();
        console.log("Publication PASS " + pub.explorer);
    }
    const single = report.workflows.single;
    single.action = "single";
    if (single.status !== "PASS") {
        if (!single.txHash) {
            const { page, context, wallet } = await signer("RENEWER", single);
            await page.goto(base + "/records/" + pub.key);
            await page.getByRole("button", { name: "Renew storage", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: /Renew storage/ });
            await dialog.getByRole("button", { name: "30 days from now", exact: true }).click();
            await dialog.getByRole("button", { name: "Connect a wallet to sign", exact: true }).click();
            await capturePlan(page, single);
            insist(single.review.replies.length === 1 && same(single.review.replies[0], pub.key), "Single plan must renew the new reply");
            single.armed = true;
            save();
            await dialog.getByRole("button", { name: /^Sign 1 transaction/ }).click();
            await waitForUI(page, single);
            insist(wallet.sent.length === 1, "Expected one single renewal request");
            await context.close();
        }
        await independentRenewal(single);
        single.reader = await readerCheck(pub.key, "single");
        single.archive = { status: "PASS", recordURL: base + "/records/" + pub.key };
        single.status = "PASS";
        save();
        console.log("Single renewal PASS " + single.explorer);
    }
    const multi = report.workflows.multi;
    multi.action = "multi";
    if (!multi.txHash) {
        const { page, context, wallet } = await signer("RENEWER", multi);
        await page.goto(base + (multi.retentionRepeat ? "/preserve?within=120" : "/preserve"));
        await anyWallet(page);
        const fresh = page.locator("tbody tr").filter({ has: page.locator(`a[href="/records/${pub.key}"]`) });
        await expect(fresh).toBeVisible({ timeout: 90000 });
        await fresh.getByRole("checkbox").check();
        const other = multi.preferredSecond ? page.locator("tbody tr").filter({ has: page.locator(`a[href="/records/${multi.preferredSecond}"]`) }) : page.locator("tbody tr").filter({ hasNot: page.locator(`a[href="/records/${pub.key}"]`) }).first();
        multi.secondReply = (await other.locator('a[href^="/records/"]').getAttribute("href")).split("/").at(-1);
        await other.getByRole("checkbox").check();
        await page.getByRole("button", { name: "Renew storage for selected", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: /Renew storage/ });
        await dialog.getByRole("button", { name: multi.retentionRepeat ? "180 days from now" : "90 days from now", exact: true }).click();
        await dialog.getByRole("button", { name: "Connect a wallet to sign", exact: true }).click();
        await capturePlan(page, multi);
        insist(multi.review.replies.length === 2 && multi.review.replies.some((key) => same(key, pub.key)), "Expected two replies in reviewed batch");
        insist(await dialog.getByRole("button", { name: /^Sign 1 transaction/ }).count(), "Expected one atomic two-reply batch");
        multi.armed = true;
        save();
        await dialog.getByRole("button", { name: /^Sign 1 transaction/ }).click();
        await waitForUI(page, multi);
        insist(wallet.sent.length === 1, "Expected one multi renewal request");
        if (multi.retentionRepeat) {
            await expect(fresh).toHaveCount(0, { timeout: 90000 });
            await expect(dialog.getByText("Verified renewal", { exact: true })).toBeVisible();
            await expect(dialog.getByLabel("Included entities", { exact: true }).locator("li")).toHaveCount(multi.review.entities.length);
            multi.queueRefreshRetained = true;
            multi.queueRowsRemoved = true;
            await page.screenshot({ path: ".release/multi-queue-refresh-retained.png", fullPage: true });
            save();
        }
        await context.close();
    }
    await independentRenewal(multi);
    multi.readers = [];
    for (const key of multi.review.replies)
        multi.readers.push(await readerCheck(key, "multi-" + key.slice(2, 10)));
    multi.archive = { status: "PASS", source: "Two selected replies appeared in the deployed preserve queue and itemized review", keys: multi.review.replies };
    multi.status = "PASS";
    save();
    console.log("Multi renewal PASS " + multi.explorer);
    report.completedAt = new Date().toISOString();
    report.status = "PASS";
    save();
}
main().catch(async (error) => { report.attempts.push({ at: new Date().toISOString(), status: "FAIL", reason: error instanceof Error ? error.message : String(error) }); report.status = "FAIL"; save(); console.error(error instanceof Error ? error.message : String(error)); if (browser) {
    for (const [i, page] of browser.contexts().flatMap(c => c.pages()).entries()) {
        await page.screenshot({ path: `.release/campaign-failure-${i}.png`, fullPage: true }).catch(() => { });
        writeFileSync(`.release/campaign-failure-${i}.txt`, await page.locator("body").innerText().catch(() => "Unavailable"));
    }
} process.exitCode = 1; }).finally(async () => { await browser?.close(); });
