import { Queue } from "bullmq"
import { connection } from "./connection"

const configuredPrefix = process.env.BULLMQ_PREFIX?.trim()

/**
 * Shared by producers and both worker shapes. SproutOS injects `BULLMQ_PREFIX` because BullMQ
 * constructs some keys inside Lua from argument data; the Valkey proxy cannot safely discover and
 * rewrite those keys after the fact.
 */
export const queueOptions = {
  connection,
  ...(configuredPrefix ? { prefix: configuredPrefix } : {}),
}

export const fastQueue = new Queue("fast", queueOptions)
export const mediumQueue = new Queue("medium", queueOptions)
export const slowQueue = new Queue("slow", queueOptions)
