# SproutOS sandbox smoke test

Produced by the production Daytona agent on 2026-08-27 as a harmless connectivity and tooling
check. This file documents a smoke test only — it changes no application behaviour.

- Sandbox checkout: `/home/daytona/workspace`
- Daytona sandbox id: `607dfc57-16da-4414-b2f4-465244d679a3`

## Results

### Public internet through the SproutOS proxy — PASS

`curl https://example.com` returned HTTP 200 (559 bytes) through the pre-configured
`HTTPS_PROXY` at `http://172.20.0.1:18080`. Proxy environment variables were read, never
modified or bypassed. `pnpm install` also completed over the same path (28.9s), which
exercises the proxy against the npm registry as well.

### Repository check — dependencies install; suite blocked on Postgres

`pnpm install` succeeded. `pnpm test` ran the workspace Vitest suite:

```
Test Files  20 failed | 5 passed (25)
     Tests  30 passed | 76 skipped (106)
```

Every failure is `connect ECONNREFUSED 127.0.0.1:5432` — the integration tests expect a local
Postgres. This sandbox has no `DATABASE_URL` set and no Docker daemon, so `docker-compose.yaml`
cannot bring one up. The pure unit tests that do not touch the database all pass.

### Dev server — running, reachable

`next dev --turbopack -H 0.0.0.0 -p 3000` for `apps/website`, launched detached with `setsid`
so it survives the agent turn (top-level process reparented to PID 1). Logs at
`/tmp/dev-server.log`.

Preview URL: `https://3000-607dfc57-16da-4414-b2f4-465244d679a3.proxy.daytona.works`

| Path | Status |
| --- | --- |
| `/login` | 200 |
| `/about` | 200 |
| `/` | 500 — `loadPopularFeed` SSR query hits the missing Postgres |

The homepage 500 shares the single root cause above: `src/lib/feed-ssr.ts` queries the database
during server-side render, and there is no database in this sandbox. Static and auth-entry pages
render correctly, so the toolchain itself is healthy.

Note: requesting the server with a literal `0.0.0.0` Host header returns 403 from the Next dev
origin check. Use `localhost` or the preview hostname.
