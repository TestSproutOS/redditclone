# RedditClone background work on SproutOS

This is the handoff for the queue-to-Lambda conversion. It deliberately references the launch
history that led here, rather than presenting the current shape as if it had always existed:

- `private_notes/groups.md` and the legacy `read-the-readme-md-to-eventual-dusk.md` plan established
  that the RedditClone repository is one SproutOS group with separate web, API, dashboard and admin
  projects.
- `private_notes/sandbox-handoff.md` records that an earlier “verified” sandbox used Docker rather
  than Daytona. It is unrelated to executing customer background work and must not be used as proof
  that this Lambda path runs.
- The legacy `double-sorted-meteor.md` plan found that tenant BullMQ clients need the injected
  `BULLMQ_PREFIX`; the queue producer and both worker shapes now use the same option.

## What is converted

SproutOS does not require a continuously running BullMQ worker. When an enqueue passes through the
tenant Valkey proxy, the router invokes the owning project's Lambda with:

```json
{
  "sproutos": {
    "kind": "queue.drain",
    "queue": "fast",
    "resource": "...",
    "maxJobs": 25
  }
}
```

The Lambda Web Adapter forwards non-HTTP events to `POST /events`. RedditClone verifies the
adapter's `PassThrough` request context, manually fetches at most `maxJobs`, and closes the worker
before returning. A public ALB request to `/events` has an ALB request context and receives 404.

All eleven existing processors share one fail-closed dispatcher:

| Queue  | Jobs                                                             |
| ------ | ---------------------------------------------------------------- |
| fast   | post, comment, community and user search sync                    |
| medium | rising recompute, scheduled publish, recurring-post scheduler    |
| slow   | media cleanup, draft expiry, search backfill, link-preview fetch |

If a capped drain leaves waiting jobs, it enqueues one no-op continuation. That enqueue wakes the
router again; without it, a burst larger than 25 can strand its tail after the router coalesces the
original wakeups.

The old `apps/bullground` process remains as a development driver. Production should deploy the API
Lambda and must not keep an idle worker service running.

## Platform gaps that still block complete replacement

The immediate jobs above can be drained on demand. These time-based promises cannot be made correct
by customer code alone:

1. **Delayed BullMQ jobs need a due-time wake.** `scheduled-post-publish` can be six months away and
   `media-cleanup` is delayed 30 minutes. The router wakes on enqueue, not when BullMQ promotes a
   delayed job. A finite Lambda cannot wait for either. SproutOS must schedule a new invocation for
   the next delayed timestamp, or offer an equivalent durable delayed workflow trigger.
2. **Recurring jobs need a working control-plane scheduler.** Rising recompute, recurring-post
   scheduling and draft expiry currently depend on `upsertJobScheduler()` in a standing worker.
   The platform has `workflow_schedule` rows and a `trigger.cron` graph node, but current main has no
   route that writes schedules and no job that creates cron workflow runs.
3. **HTTP failures must become Lambda failures.** Lambda Web Adapter returns an HTTP 500 as a normal
   invocation result unless `AWS_LWA_ERROR_STATUS_CODES` includes `500-599`. SproutOS must inject
   that setting for adapted functions so Lambda's asynchronous retry/DLQ behavior can see a failed
   drain.
4. **Graph workflows cannot carry these dynamic payloads yet.** The four search-sync jobs,
   scheduled publish, media cleanup and link-preview fetch need the entity id from the enqueueing
   event. Current workflow runs store static node config and do not propagate trigger payloads into
   action input. Converting them into graph nodes would hard-code an id, not replace the queue.

Do not delete the standing worker deployment until items 1–3 are shipped and verified with delayed,
recurring, failed and greater-than-25 production batches. Code existing is not the verification;
the legacy reports above are explicit about that distinction.
