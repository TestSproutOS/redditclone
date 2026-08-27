import { randomUUID } from "node:crypto"
import { Queue, Worker, type Job } from "bullmq"
import { queueOptions } from "@utils/queues"
import { CONTINUATION_JOB, processQueueJob, type QueueName } from "./dispatch"

export const MAX_DRAIN_JOBS = 25

export type DrainResult = {
  processed: number
  continuationQueued: boolean
}

/**
 * Drain at most the number of jobs the SproutOS router authorized for this invocation.
 *
 * Manual fetching makes the Lambda lifetime finite; `Worker.run()` waits forever for more work.
 * When the cap is reached, a tiny no-op job creates another enqueue signal. Without it, a burst of
 * 26 jobs can leave the 26th waiting forever because the router coalesces the original wakeups.
 */
export async function drainQueue(queueName: QueueName, maxJobs: number): Promise<DrainResult> {
  if (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > MAX_DRAIN_JOBS) {
    throw new Error(`maxJobs must be an integer from 1 to ${MAX_DRAIN_JOBS}`)
  }

  const worker = new Worker(queueName, (job) => processQueueJob(queueName, job), {
    ...queueOptions,
    autorun: false,
  })
  const queue = new Queue(queueName, queueOptions)
  let processed = 0
  let continuationQueued = false

  try {
    await worker.startStalledCheckTimer()

    while (processed < maxJobs) {
      const token = randomUUID()
      const job = (await worker.getNextJob(token, { block: false })) as Job | undefined
      if (job === undefined) break
      await worker.processJob(job, token, () => false)
      processed += 1
    }

    if (processed === maxJobs && (await queue.getWaitingCount()) > 0) {
      await queue.add(
        CONTINUATION_JOB,
        {},
        {
          jobId: `sproutos-continuation-${randomUUID()}`,
          removeOnComplete: true,
          removeOnFail: true,
        },
      )
      continuationQueued = true
    }
  } finally {
    await Promise.allSettled([worker.close(), queue.close()])
  }

  return { processed, continuationQueued }
}
