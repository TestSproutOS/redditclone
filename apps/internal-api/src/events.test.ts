import { describe, expect, it, vi } from "vitest"
import { createEventsApp, isLambdaPassThroughContext } from "./events"

type Drain = NonNullable<Parameters<typeof createEventsApp>[0]>

const passThroughHeaders = {
  "content-type": "application/json",
  "x-amzn-request-context": JSON.stringify("PassThrough"),
}

describe("SproutOS Lambda events", () => {
  it("recognizes only the Lambda Web Adapter pass-through context", () => {
    expect(isLambdaPassThroughContext(JSON.stringify("PassThrough"))).toBe(true)
    expect(isLambdaPassThroughContext(JSON.stringify({ elb: {} }))).toBe(false)
    expect(isLambdaPassThroughContext("not-json")).toBe(false)
    expect(isLambdaPassThroughContext(undefined)).toBe(false)
  })

  it("drains the queue and limit named by the router", async () => {
    const drain = vi.fn<Drain>(() => Promise.resolve({ processed: 3, continuationQueued: false }))
    const app = createEventsApp(drain)

    const response = await app.request("/events", {
      method: "POST",
      headers: passThroughHeaders,
      body: JSON.stringify({
        sproutos: { kind: "queue.drain", queue: "fast", resource: "01abc", maxJobs: 25 },
      }),
    })

    expect(response.status).toBe(200)
    expect(drain).toHaveBeenCalledWith("fast", 25)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      queue: "fast",
      processed: 3,
      continuationQueued: false,
    })
  })

  it("does not expose queue draining as a public HTTP endpoint", async () => {
    const drain = vi.fn<Drain>()
    const app = createEventsApp(drain)
    const body = JSON.stringify({
      sproutos: { kind: "queue.drain", queue: "slow", resource: "01abc", maxJobs: 25 },
    })

    for (const context of [undefined, JSON.stringify({ elb: {} }), "spoofed"]) {
      const headers = { "content-type": "application/json" } as Record<string, string>
      if (context !== undefined) headers["x-amzn-request-context"] = context
      const response = await app.request("/events", { method: "POST", headers, body })
      expect(response.status).toBe(404)
    }
    expect(drain).not.toHaveBeenCalled()
  })

  it("refuses unknown queues and router limits outside the production cap", async () => {
    const drain = vi.fn<Drain>()
    const app = createEventsApp(drain)

    for (const sproutos of [
      { kind: "queue.drain", queue: "other", resource: "01abc", maxJobs: 25 },
      { kind: "queue.drain", queue: "fast", resource: "01abc", maxJobs: 26 },
      { kind: "queue.drain", queue: "fast", resource: "", maxJobs: 25 },
    ]) {
      const response = await app.request("/events", {
        method: "POST",
        headers: passThroughHeaders,
        body: JSON.stringify({ sproutos }),
      })
      expect(response.status).toBe(400)
    }
    expect(drain).not.toHaveBeenCalled()
  })
})
