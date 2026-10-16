import { expect, it, vi } from "vitest"
import { createArchiveReader, scan, type ArchiveClient } from "../src/reader.js"
import { decodeReply } from "../src/schema.js"
import { replyEntity } from "./fixtures.js"

it("pins scan continuation to its first block after the head advances", async () => {
  const query = vi.fn(async (_q: string, opts: { cursor?: string; atBlock?: bigint } = {}) => {
    if (opts.cursor) {
      expect(opts.atBlock).toBe(7n)
      return { entities: [replyEntity(1), replyEntity(2)], cursor: undefined, blockNumber: 7n }
    }
    return { entities: [replyEntity(1)], cursor: "page-two", blockNumber: 7n }
  })
  const client = { query } as unknown as ArchiveClient
  const result = await scan(client, "query", decodeReply, { pageSize: 1 })
  expect(result.records).toHaveLength(2)
  expect(result.blockNumber).toBe(7n)
  expect(result.complete).toBe(true)
})

it("refuses a bare cursor and a response from a different snapshot", async () => {
  const query = vi.fn(async () => ({ entities: [], cursor: undefined, blockNumber: 8n }))
  const reader = createArchiveReader({ query } as unknown as ArchiveClient)
  await expect(reader.searchReplies({}, { cursor: "next" })).rejects.toThrow(/original atBlock/)
  expect(query).not.toHaveBeenCalled()
  await expect(reader.searchReplies({}, { cursor: "next", atBlock: 7n })).rejects.toThrow(/different snapshot/)
})

it("cancels a caller waiting for a noncooperative provider", async () => {
 const reader = createArchiveReader({ query: () => new Promise(()=>{}) } as unknown as ArchiveClient)
 const controller = new AbortController()
 const pending = reader.searchReplies({}, { signal:controller.signal })
 controller.abort(new Error("left the archive"))
 await expect(pending).rejects.toThrow(/left the archive/)
})
