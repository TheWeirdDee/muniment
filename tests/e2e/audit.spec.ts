import { expect, test } from "@playwright/test"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"

const dashboard = process.env.DASHBOARD_URL || "https://muniment-insights.vercel.app"
test("MUN-AUD-010 sequential endpoint typing keeps focus and nested Escape restores it", async ({ page, isMobile }) => {
 await page.goto("/archive")
 if (isMobile) await page.getByRole("button", { name:"Open menu" }).click()
 await page.getByRole("button", { name:"Settings", exact:true }).click()
 await page.getByRole("button", { name:"Network settings", exact:true }).click()
 const dialog = page.getByRole("dialog", { name:"Network settings", exact:true })
 for (const [label, value] of [["HTTP endpoint","https://example.invalid"], ["WebSocket endpoint (live updates)","wss://example.invalid"]]) {
   const field = dialog.getByLabel(label, { exact:true })
   await field.click(); await field.press("ControlOrMeta+A"); await field.press("Backspace")
   await field.pressSequentially(value)
   await expect(field).toHaveValue(value); await expect(field).toBeFocused()
 }
 await page.keyboard.press("Escape")
 await expect(dialog).toHaveCount(0)
 await expect(page.getByRole("button", { name:"Network settings", exact:true })).toBeFocused()
 await page.keyboard.press("Escape")
})

test("MUN-AUD-001 archive Load more survives a real block change", async ({ page }) => {
 const pages: { block:string; options:any }[] = []
 page.on("response", async (res) => {
   if (!res.url().includes("rpc.tiramisu")) return
   try { const body=await res.json(); const req=res.request().postDataJSON(); if (body.result?.data && req.method === "arkiv_query" && req.params[0].includes("kind = str('reply')")) pages.push({ block:body.result.blockNumber, options:req.params[1] }) } catch {}
 })
 await page.goto("/archive")
 await expect(page.locator(".reply-row")).toHaveCount(25, { timeout:45000 })
 await page.waitForTimeout(3500)
 await page.getByRole("button", { name:/Load more/ }).click()
 await expect(page.locator(".reply-row")).toHaveCount(41, { timeout:45000 })
 expect(pages.length).toBeGreaterThanOrEqual(2)
 expect(pages.at(-1)!.options.atBlock).toBe(pages[0].block)
 expect(pages.at(-1)!.block).toBe(pages[0].block)
})

test("MUN-AUD-001 disk reader retains snapshot through delayed pages", async ({ page }) => {
 await page.goto(pathToFileURL(resolve("reader/reader.html")).href)
 await page.locator("#limit").selectOption("10")
 await page.getByRole("button", { name:"Search Arkiv", exact:true }).click()
 await expect(page.locator("#results .item")).toHaveCount(10, { timeout:45000 })
 const first = /block ([\d,]+)/.exec(await page.locator("#status").innerText())![1]
 await page.waitForTimeout(3500)
 for (const count of [20,30,40,41]) { await page.getByRole("button", { name:"Next page", exact:true }).click(); await expect(page.locator("#results .item")).toHaveCount(count, { timeout:45000 }) }
 expect(await page.locator("#status").innerText()).toContain(`block ${first}`)
})

test("MUN-AUD-003/004 invalid dashboard trust fails closed and failed reload clears all figures", async ({ page }) => {
 await page.goto(dashboard)
 await expect(page.locator("#coverage")).toContainText("41 live synthetic replies", { timeout:45000 })
 const previous = await page.evaluate(()=>localStorage.getItem("muniment.insights.creators"))
 for (const value of ["not-a-wallet", "0x817574740F413816636FAE23064607084e2C0604,not-a-wallet"]) {
   await page.locator("#creators").fill(value)
   await page.getByRole("button", { name:"Load from Arkiv" }).click()
   await expect(page.locator("#coverage")).toContainText("Every trusted publisher")
   expect(await page.evaluate(()=>localStorage.getItem("muniment.insights.creators"))).toBe(previous)
   await expect(page.locator("#tiles")).toBeEmpty()
 }
 await page.locator("#creators").fill("0x817574740F413816636FAE23064607084e2C0604")
 await page.getByRole("button", { name:"Load from Arkiv" }).click()
 await expect(page.locator("#coverage")).toContainText("41 live synthetic replies", { timeout:45000 })
 await page.locator("#creators").fill("")
 await page.getByRole("button", { name:"Load from Arkiv" }).click()
 await expect(page.locator("#coverage")).toContainText("from any wallet", { timeout:45000 })
 await expect(page.locator("#query")).not.toContainText("$creator")
 await page.locator("#endpoint").fill("http://example.invalid")
 await page.getByRole("button", { name:"Load from Arkiv" }).click()
 await expect(page.locator("#coverage")).toContainText("Previous figures have been cleared")
 await page.getByRole("button", { name:"Toggle theme" }).click()
 for (const selector of ["#tiles","#chart-median","#chart-outcomes","#chart-dist","#table","#query"]) await expect(page.locator(selector)).toBeEmpty()
})

test("MUN-AUD-004 an older in-flight dashboard load cannot replace a newer error", async ({ page }) => {
 await page.goto(dashboard)
 await expect(page.locator("#coverage")).toContainText("41 live synthetic replies", { timeout:45000 })
 let release!:()=>void, observed!:()=>void
 const held = new Promise<void>((r)=>{release=r}), seen = new Promise<void>((r)=>{observed=r})
 await page.route("https://race-delay.invalid/**", async (route) => {
   observed()
   try { const response=await route.fetch({url:"https://rpc.tiramisu.db-chain.testnet.arkiv.network"}); await held; await route.fulfill({response}) } catch {}
 })
 await page.locator("#endpoint").fill("https://race-delay.invalid")
 await page.getByRole("button",{name:"Load from Arkiv"}).click()
 await seen
 await page.locator("#endpoint").fill("http://example.invalid")
 await page.getByRole("button",{name:"Load from Arkiv"}).click()
 release()
 await expect(page.locator("#coverage")).toContainText("Previous figures have been cleared")
 await page.waitForTimeout(1000)
 await expect(page.locator("#coverage")).toContainText("Use an https:// endpoint")
 await expect(page.locator("#tiles")).toBeEmpty()
})

test("MUN-AUD-008 synthetic boundary fixture discloses linked scan bounds in UI and export", async ({ page }) => {
 const key = `0x${"a".repeat(64)}`
 const toHex = (x:unknown) => `0x${Buffer.from(JSON.stringify(x)).toString("hex")}`
 const entity = (n:number) => ({ key:`0x${n.toString(16).padStart(64,"0")}`, createdAt:"0x1", updatedAt:"0x1", creationFlags:{readonly:true,permissionlessExtension:true}, creator:"0x817574740F413816636FAE23064607084e2C0604", owner:"0x000000000000000000000000000000000000dead", expiresAt:"0xffff", attributes:[{name:"app",value:"muniment-archive"}], payload:toHex({ synthetic:true,title:"Synthetic boundary test fixture",grounds:"Synthetic test claim" }) })
 await page.route("https://rpc.tiramisu.db-chain.testnet.arkiv.network/**", async (route) => {
   const request=route.request().postDataJSON()
   let result:any="0x7614d1"
   if(request.method === "eth_blockNumber") result="0x10"
   if(request.method === "arkiv_query") {
     const [query,options]=request.params
     if(query.startsWith("$key")) result={ data:[entity(999)], blockNumber:"0x10" }
     else {
       expect(options.atBlock).toBe("0x10")
       const appeal=query.includes("str('appeal')")
       const offset=options.cursor ? Number(options.cursor) : 0
       // 151 links deliberately exceed the three-page, 150-record bound.
       result={data:appeal ? Array.from({length:50},(_,i)=>entity(offset+i+1)) : [],cursor:appeal ? String(offset+50) : undefined,blockNumber:"0x10"}
     }
   }
   await route.fulfill({json:{jsonrpc:"2.0",id:request.id,result}})
 })
 await page.goto(pathToFileURL(resolve("reader/reader.html")).href)
 await page.locator("#key").fill(key)
 await page.getByRole("button",{name:"Read record",exact:true}).click()
 await expect(page.getByRole("heading",{name:/Appeals: 150 loaded.*PARTIAL/})).toBeVisible()
 const [download] = await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Export this record as JSON"}).click()])
 const chunks=await(await download.createReadStream()).toArray()
 const exported=JSON.parse(Buffer.concat(chunks).toString())
 expect(exported.linkedCoverage.appeals).toMatchObject({complete:false,cursor:"150",readAtBlock:"0x10",pages:3})
 expect(exported.linkedCoverage.reviews.complete).toBe(true)
})
