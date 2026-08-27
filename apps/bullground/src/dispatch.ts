import type { Job } from "bullmq"
import type { JobName, JobPayloadMap } from "@utils/queues"
import { processDraftExpiry } from "./jobs/draftExpiry"
import { processEsBackfill } from "./jobs/esBackfill"
import { processLinkPreviewFetch } from "./jobs/linkPreviewFetch"
import {
  processEsSyncComment,
  processEsSyncCommunity,
  processEsSyncPost,
  processEsSyncUser,
} from "./jobs/esSync"
import { processMediaCleanup } from "./jobs/mediaCleanup"
import { processRecurringPostScheduler } from "./jobs/recurringPostScheduler"
import { processRisingRecompute } from "./jobs/risingRecompute"
import { processScheduledPostPublish } from "./jobs/scheduledPostPublish"

export type QueueName = "fast" | "medium" | "slow"

export const CONTINUATION_JOB = "__sproutos-continue"

const JOB_QUEUE: Record<JobName, QueueName> = {
  "es-sync-post": "fast",
  "es-sync-comment": "fast",
  "es-sync-community": "fast",
  "es-sync-user": "fast",
  "rising-recompute": "medium",
  "scheduled-post-publish": "medium",
  "recurring-post-scheduler": "medium",
  "media-cleanup": "slow",
  "draft-expiry": "slow",
  "es-backfill": "slow",
  "link-preview-fetch": "slow",
}

export function isQueueName(value: string): value is QueueName {
  return value === "fast" || value === "medium" || value === "slow"
}

/**
 * Run one RedditClone job from either the long-lived development worker or a bounded SproutOS
 * Lambda queue drain.
 *
 * Queue ownership is checked here. The old worker used independent `if` statements, so a typo or
 * a job placed on the wrong queue completed successfully without doing anything. That is a lost
 * background job wearing a green status; this dispatcher fails it instead.
 */
export async function processQueueJob(queue: QueueName, job: Job): Promise<void> {
  if (job.name === CONTINUATION_JOB) return

  const expected = JOB_QUEUE[job.name as JobName]
  if (expected === undefined) throw new Error(`Unsupported ${queue} queue job: ${job.name}`)
  if (expected !== queue) {
    throw new Error(`Job ${job.name} belongs to the ${expected} queue, not ${queue}`)
  }

  switch (job.name as JobName) {
    case "es-sync-post":
      return processEsSyncPost(job.data as JobPayloadMap["es-sync-post"])
    case "es-sync-comment":
      return processEsSyncComment(job.data as JobPayloadMap["es-sync-comment"])
    case "es-sync-community":
      return processEsSyncCommunity(job.data as JobPayloadMap["es-sync-community"])
    case "es-sync-user":
      return processEsSyncUser(job.data as JobPayloadMap["es-sync-user"])
    case "rising-recompute":
      return processRisingRecompute(job.data as JobPayloadMap["rising-recompute"])
    case "scheduled-post-publish":
      return processScheduledPostPublish(job.data as JobPayloadMap["scheduled-post-publish"])
    case "recurring-post-scheduler":
      return processRecurringPostScheduler(job.data as JobPayloadMap["recurring-post-scheduler"])
    case "media-cleanup":
      return processMediaCleanup(job as Job<JobPayloadMap["media-cleanup"]>)
    case "draft-expiry":
      return processDraftExpiry(job.data as JobPayloadMap["draft-expiry"])
    case "es-backfill":
      return processEsBackfill(job.data as JobPayloadMap["es-backfill"])
    case "link-preview-fetch":
      return processLinkPreviewFetch(job.data as JobPayloadMap["link-preview-fetch"])
  }
}
