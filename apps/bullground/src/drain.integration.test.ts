import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { Queue } from "bullmq"

const run = process.env.RUN_VALKEY_INTEGRATION === "1" ? describe : describe.skip

run("bounded SproutOS queue drain", () => {
  let queue: Queue
  let drainQueue: (
    queue: "fast",
    maxJobs: number,
  ) => Promise<{
    processed: number
    continuationQueued: boolean
  }>

  beforeAll(async () => {
    process.env.BULLMQ_PREFIX = `test-${randomUUID()}`
    vi.resetModules()

    const [{ Queue }, queues, bullground] = await Promise.all([
      import("bullmq"),
      import("@utils/queues"),
      import("./lib"),
    ])
    queue = new Queue("fast", queues.queueOptions)
    drainQueue = bullground.drainQueue
  })

  afterAll(async () => {
    if (queue) {
      await queue.obliterate({ force: true })
      await queue.close()
    }
  })

  it("continues a burst larger than the router's per-invocation cap", async () => {
    for (let index = 0; index < 3; index++) {
      await queue.add("__sproutos-continue", {}, { jobId: `seed-${index}` })
    }

    await expect(drainQueue("fast", 2)).resolves.toEqual({
      processed: 2,
      continuationQueued: true,
    })

    await expect(drainQueue("fast", 25)).resolves.toEqual({
      processed: 2,
      continuationQueued: false,
    })
    await expect(queue.getWaitingCount()).resolves.toBe(0)
  })
})
