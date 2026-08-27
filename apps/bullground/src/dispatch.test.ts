import type { Job } from "bullmq"
import { afterEach, describe, expect, it, vi } from "vitest"

type Handler = () => Promise<void>

const handlers = vi.hoisted(() => ({
  draftExpiry: vi.fn<Handler>(() => Promise.resolve()),
  esBackfill: vi.fn<Handler>(() => Promise.resolve()),
  linkPreview: vi.fn<Handler>(() => Promise.resolve()),
  syncComment: vi.fn<Handler>(() => Promise.resolve()),
  syncCommunity: vi.fn<Handler>(() => Promise.resolve()),
  syncPost: vi.fn<Handler>(() => Promise.resolve()),
  syncUser: vi.fn<Handler>(() => Promise.resolve()),
  mediaCleanup: vi.fn<Handler>(() => Promise.resolve()),
  recurring: vi.fn<Handler>(() => Promise.resolve()),
  rising: vi.fn<Handler>(() => Promise.resolve()),
  scheduled: vi.fn<Handler>(() => Promise.resolve()),
}))

vi.mock("./jobs/draftExpiry", () => ({ processDraftExpiry: handlers.draftExpiry }))
vi.mock("./jobs/esBackfill", () => ({ processEsBackfill: handlers.esBackfill }))
vi.mock("./jobs/linkPreviewFetch", () => ({ processLinkPreviewFetch: handlers.linkPreview }))
vi.mock("./jobs/esSync", () => ({
  processEsSyncComment: handlers.syncComment,
  processEsSyncCommunity: handlers.syncCommunity,
  processEsSyncPost: handlers.syncPost,
  processEsSyncUser: handlers.syncUser,
}))
vi.mock("./jobs/mediaCleanup", () => ({ processMediaCleanup: handlers.mediaCleanup }))
vi.mock("./jobs/recurringPostScheduler", () => ({
  processRecurringPostScheduler: handlers.recurring,
}))
vi.mock("./jobs/risingRecompute", () => ({ processRisingRecompute: handlers.rising }))
vi.mock("./jobs/scheduledPostPublish", () => ({
  processScheduledPostPublish: handlers.scheduled,
}))

import { CONTINUATION_JOB, processQueueJob, type QueueName } from "./dispatch"

function job(name: string): Job {
  return { name, data: { marker: name } } as Job
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("background job dispatcher", () => {
  it.each([
    ["fast", "es-sync-post", handlers.syncPost],
    ["fast", "es-sync-comment", handlers.syncComment],
    ["fast", "es-sync-community", handlers.syncCommunity],
    ["fast", "es-sync-user", handlers.syncUser],
    ["medium", "rising-recompute", handlers.rising],
    ["medium", "scheduled-post-publish", handlers.scheduled],
    ["medium", "recurring-post-scheduler", handlers.recurring],
    ["slow", "media-cleanup", handlers.mediaCleanup],
    ["slow", "draft-expiry", handlers.draftExpiry],
    ["slow", "es-backfill", handlers.esBackfill],
    ["slow", "link-preview-fetch", handlers.linkPreview],
  ] as const)("routes %s/%s to its processor", async (queue, name, handler) => {
    await processQueueJob(queue, job(name))
    expect(handler).toHaveBeenCalledOnce()
  })

  it("fails an unknown job instead of completing it without work", async () => {
    await expect(processQueueJob("fast", job("misspelled"))).rejects.toThrow(
      "Unsupported fast queue job: misspelled",
    )
  })

  it("fails a known job placed on the wrong queue", async () => {
    await expect(processQueueJob("slow", job("es-sync-post"))).rejects.toThrow(
      "Job es-sync-post belongs to the fast queue, not slow",
    )
  })

  it("accepts the internal continuation on every queue without running customer work", async () => {
    for (const queue of ["fast", "medium", "slow"] satisfies QueueName[]) {
      await processQueueJob(queue, job(CONTINUATION_JOB))
    }
    expect(Object.values(handlers).every((handler) => handler.mock.calls.length === 0)).toBe(true)
  })
})
