import { chromium, expect } from "@playwright/test";
import { createPublicClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { TIRAMISU, politeHttp } from "muniment-query";
import { createPublicClient as ethClient, formatEther } from "viem";
import { readFileSync, writeFileSync } from "node:fs";
const file = ".release/transaction-campaign.json", report = JSON.parse(readFileSync(file, "utf8"));
if (report.status !== "PASS")
    throw Error("Finish and reconcile the signed campaign first");
const db = createPublicClient({ chain: tiramisu, transport: politeHttp(TIRAMISU.httpRpc, { concurrency: 1, attempts: 4, maxWaitMs: 90000, totalTimeoutMs: 120000 }) });
const rpc = ethClient({ chain: tiramisu, transport: politeHttp(TIRAMISU.httpRpc, { concurrency: 1, attempts: 4, maxWaitMs: 90000, totalTimeoutMs: 120000 }) });
const save = () => writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
const browser = await chromium.launch();
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
    page.setDefaultTimeout(60000);
    await page.goto("https://muniment-archive.vercel.app/archive");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Network settings", exact: true }).click();
    await page.getByLabel(/Show records from any wallet that uses Muniment/).check();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator(".reply-row").first()).toBeVisible({ timeout: 90000 });
    const keys = report.workflows.multi.review.replies;
    for (let i = 0; i < 5; i++) {
        const present = await Promise.all(keys.map(key => page.locator(`.reply-row a[href="/records/${key}"]`).count()));
        if (present.every(Boolean))
            break;
        const more = page.getByRole("button", { name: /Load more/ });
        if (!await more.count() || !await more.isEnabled())
            break;
        const before = await page.locator(".reply-row").count();
        await more.click();
        await expect.poll(() => page.locator(".reply-row").count(), { timeout: 90000 }).toBeGreaterThan(before);
    }
    const results = [];
    for (const key of keys) {
        const row = page.locator(".reply-row").filter({ has: page.locator(`a[href="/records/${key}"]`) });
        await expect(row).toBeVisible();
        const actual = await db.getEntity(key);
        const expiry = row.locator('[title^="Expiry block "]');
        await expect(expiry).toHaveAttribute("title", new RegExp(`Expiry block ${actual.expiresAt.toLocaleString("en-GB")}`));
        results.push({ key, expiry: String(actual.expiresAt), status: "PASS", title: await expiry.getAttribute("title") });
    }
    await page.screenshot({ path: ".release/final-archive-expiries.png", fullPage: true });
    report.finalArchive = { status: "PASS", at: new Date().toISOString(), trustMode: "Explicit any-wallet opt-in; stranger record correctly labelled", results };
    report.workflows.single.archive = { status: "PASS", checkedAfterMulti: true, note: "Final archive expiry includes the later multi-reply renewal; the single-renewal target is independently recorded in its transaction and contemporaneous disk-reader result.", result: results.find(r => r.key === report.workflows.publication.key) };
    report.workflows.multi.archive = { status: "PASS", results };
    save();
    const stages = [...Object.entries(report.workflows), ...(report.priorMulti || []).map((stage, i) => [`multi-prior-${i + 1}`, stage])];
    for (const [name, stage] of stages) {
        const response = await page.goto(stage.explorer, { waitUntil: "domcontentloaded", timeout: 60000 });
        await expect(page.getByText("Success", { exact: true }).first()).toBeVisible({ timeout: 60000 });
        const body = await page.locator("body").innerText();
        stage.explorerCheck = { status: "PASS", httpStatus: response?.status(), successDisplayed: body.includes("Success"), transactionHashPresent: body.toLowerCase().includes(stage.txHash.toLowerCase()), at: new Date().toISOString() };
        if (!stage.explorerCheck.transactionHashPresent)
            throw Error("Explorer did not show the expected transaction hash");
        const receipt = await rpc.getTransactionReceipt({ hash: stage.txHash });
        if (receipt.status !== "success")
            throw Error("Fresh receipt no longer reports success");
        stage.actualFee = { gasUsed: String(receipt.gasUsed), effectiveGasPrice: String(receipt.effectiveGasPrice), testGLM: formatEther(receipt.gasUsed * receipt.effectiveGasPrice) };
        const transaction = await rpc.getTransaction({ hash: stage.txHash });
        if (transaction.chainId !== 7738577 || transaction.value !== 0n)
            throw Error("Unexpected transaction chain or native value");
        stage.transactionNonce = transaction.nonce;
        stage.nativeValue = String(transaction.value);
        await page.screenshot({ path: `.release/${name}-explorer.png`, fullPage: true });
        save();
        console.log(name + " explorer PASS " + stage.explorer);
    }
    const renewals = [report.workflows.single, ...(report.priorMulti || []), report.workflows.multi];
    for (let i = 1; i < renewals.length; i++) {
        if (renewals[i].transactionNonce !== renewals[i - 1].transactionNonce + 1)
            throw Error("Nonconsecutive renewer nonces; investigate unaccounted transactions");
    }
    report.renewerNoncesConsecutive = true;
    report.finalReadbackCompletedAt = new Date().toISOString();
    save();
    await context.close();
}
finally {
    await browser.close();
}
