import { Hono } from "hono"
import { drainQueue, isQueueName, MAX_DRAIN_JOBS, type DrainResult } from "bullground"

type Drain = (queue: "fast" | "medium" | "slow", maxJobs: number) => Promise<DrainResult>

type QueueDrainEvent = {
  sproutos: {
    kind: "queue.drain"
    queue: "fast" | "medium" | "slow"
    resource: string
    maxJobs: number
  }
}

/**
 * The Lambda Web Adapter overwrites this header with its own typed request context. An ALB request
 * serializes as an ALB context; only a direct non-HTTP Lambda invocation serializes as
 * `PassThrough`. Checking it keeps the pass-through path from becoming a public job-run endpoint.
 */
export function isLambdaPassThroughContext(value: string | undefined): boolean {
  if (value === undefined) return false
  try {
    return JSON.parse(value) === "PassThrough"
  } catch {
    return false
  }
}

function queueDrainEvent(value: unknown): QueueDrainEvent | null {
  if (typeof value !== "object" || value === null) return null
  const sproutos = (value as { sproutos?: unknown }).sproutos
  if (typeof sproutos !== "object" || sproutos === null) return null
  const raw = sproutos as Record<string, unknown>

  if (raw.kind !== "queue.drain") return null
  if (typeof raw.queue !== "string" || !isQueueName(raw.queue)) return null
  if (typeof raw.resource !== "string" || raw.resource.length === 0) return null
  if (
    typeof raw.maxJobs !== "number" ||
    !Number.isInteger(raw.maxJobs) ||
    raw.maxJobs < 1 ||
    raw.maxJobs > MAX_DRAIN_JOBS
  ) {
    return null
  }

  return {
    sproutos: {
      kind: "queue.drain",
      queue: raw.queue,
      resource: raw.resource,
      maxJobs: raw.maxJobs,
    },
  }
}

export function createEventsApp(drain: Drain = drainQueue): Hono {
  const events = new Hono()

  events.post("/events", async (c) => {
    if (!isLambdaPassThroughContext(c.req.header("x-amzn-request-context"))) {
      // Deliberately indistinguishable from a route that does not exist. This path is internal to
      // direct Lambda invocation and is not an application API.
      return c.json({ error: "Not found" }, 404)
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "Invalid event JSON" }, 400)
    }

    const event = queueDrainEvent(body)
    if (event === null) return c.json({ error: "Unsupported SproutOS event" }, 400)

    const result = await drain(event.sproutos.queue, event.sproutos.maxJobs)
    return c.json({ ok: true, queue: event.sproutos.queue, ...result })
  })

  return events
}

export default createEventsApp()
