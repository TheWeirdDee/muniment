import { describe, expect, it, vi } from "vitest"
import type { Receipt, RenewalUnit, VerificationState } from "muniment-query"
import { reconcileBatch } from "../../apps/web/src/lib/renew-reconcile"
import { k, RENEWER } from "../../packages/muniment-query/test/fixtures"

function setup() {
  const batch = [
    { reply:k(1), items:[{key:k(1)}, {key:k(2),kind:"appeal"}] },
    { reply:k(3), items:[{key:k(3)}, {key:k(4),kind:"exemption"}] },
  ] as RenewalUnit[]
  const receipts = [1,3].map((n,i)=>({ key:k(10+i),reply:k(n),targetExpiry:1000n,creator:RENEWER,payload:{extendedCount:2} })) as Receipt[]
  const extended = [1,2,3,4].map(n=>({key:k(n),expiresAt:1000n}))
  const reads = {
    receipt:vi.fn(async (key:string)=>receipts.find(r=>r.key===key)??null),
    verify:vi.fn(async ():Promise<VerificationState>=>({state:"verified",txHash:k(99),renewer:RENEWER,block:10n,extended})),
    expiry:vi.fn(async (_key:string)=>1000n as bigint|null),
  }
  const run = (created=receipts.map(r=>r.key))=>reconcileBatch(batch,1000n,k(99),RENEWER,created,reads)
  return { batch, receipts, reads, extended, run }
}
describe("complete renewal batch reconciliation",()=>{
  it("matches reordered receipts by reply and reads every linked expiry",async()=>{
    const f=setup(), result=await f.run([k(11),k(10)])
    expect(result.state).toBe("verified")
    expect(result.replies.map(r=>r.receipt)).toEqual([k(10),k(11)])
    expect(f.reads.expiry.mock.calls.map(c=>c[0]).sort()).toEqual([k(1),k(2),k(3),k(4)])
    expect(f.reads.verify).toHaveBeenCalledTimes(2)
  })
  it("keeps the second reply pending when its receipt is delayed",async()=>{
    const f=setup(); f.reads.receipt.mockImplementation(async key=>key===k(11)?null:f.receipts[0])
    const r=await f.run(); expect(r.state).toBe("pending");expect(r.replies.map(x=>x.state)).toEqual(["verified","pending"])
  })
  it("does not lose first-reply success if a non-first linked expiry is behind",async()=>{
    const f=setup();f.reads.expiry.mockImplementation(async key=>key===k(4)?999n:1000n)
    const r=await f.run();expect(r.state).toBe("pending");expect(r.replies.map(x=>x.state)).toEqual(["verified","pending"])
  })
  it.each(["missing","wrong-target","extra","duplicate"])("rejects %s extension events",async kind=>{
    const f=setup()
    if(kind==="missing")f.extended.pop()
    if(kind==="wrong-target")f.extended[3].expiresAt=999n
    if(kind==="extra")f.extended.push({key:k(5),expiresAt:1000n})
    if(kind==="duplicate")f.extended[3]=f.extended[2]
    expect((await f.run()).state).toBe("unverified")
  })
  it.each(["transaction","wallet"])("rejects a different %s despite a verified claim",async field=>{
    const f=setup();f.reads.verify.mockResolvedValue({state:"verified",txHash:field==="transaction"?k(98):k(99),renewer:field==="wallet"?k(97):RENEWER,block:10n,extended:f.extended})
    expect((await f.run()).state).toBe("unverified")
  })
  it.each(["reply","target","count","creator"])("rejects incorrect receipt %s",async field=>{
    const f=setup()
    if(field==="reply")f.receipts[1].reply=k(1)
    if(field==="target")f.receipts[1].targetExpiry=1001n
    if(field==="count")f.receipts[1].payload!.extendedCount=1
    if(field==="creator")f.receipts[1].creator=k(98)
    expect((await f.run()).state).toBe("unverified")
  })
  it("rejects missing SDK receipt keys and duplicate keys",async()=>{
    const f=setup();expect((await f.run([k(10)])).state).toBe("unverified");expect((await f.run([k(10),k(10)])).state).toBe("unverified")
  })
  it("keeps read failure pending, then rechecks the same transaction successfully",async()=>{
    const f=setup();f.reads.verify.mockRejectedValueOnce(new Error("RPC unavailable"))
    expect((await f.run()).state).toBe("pending");expect((await f.run()).state).toBe("verified")
  })
  it("never treats null current expiry or an empty batch as verified",async()=>{
    const f=setup();f.reads.expiry.mockResolvedValue(null);expect((await f.run()).state).toBe("pending")
    expect((await reconcileBatch([],1000n,k(99),RENEWER,[],f.reads)).state).toBe("pending")
  })
})
