# Working on this repository in SproutOS

This checkout is inside a SproutOS sandbox. The platform's own conventions are below, and they
override habits from other projects — particularly around deployment, which SproutOS performs and
your build scripts must not.

---
name: sproutos
description: How this repository is built, deployed and connected on SproutOS — the deploy workflow, backend services, environment variables, migrations, and project groups. Use when the task involves deploying, adding a database or queue, wiring environment variables, running migrations, or making the repository work on SproutOS.
---

# Deploying this repository on SproutOS

## Where you are right now

You are in a SproutOS sandbox: a container of your own, with this repository checked out at
`/workspace`. A shell here is a real shell — install things, run the test suite, start a dev
server. Nothing you run reaches the platform's own infrastructure.

**There is a database.** `DATABASE_URL` points at a *branch* of this project's Postgres, made for
this sandbox. It is a copy: migrate it, seed it, drop a table. Production is not on the other end of
that credential, and cannot be reached from here.

**A person may be watching a port.** A dev server on 3000, 5173 or 8080 is shown to the customer as
a live preview. Bind to `0.0.0.0`, not `127.0.0.1` — a server listening on loopback inside a
container is invisible from outside it, which looks to the customer like a preview that never loads.

**HTTP and HTTPS internet access is already routed through SproutOS.** Web requests, package
managers, and HTTPS Git remotes work normally; the proxy settings are already in the environment.
Use HTTPS rather than SSH for Git. Arbitrary raw TCP protocols are not available from this sandbox.

**Your work is committed for you.** At the end of the turn everything in the checkout is staged,
committed and pushed to a branch — never to the production branch. So: do not commit secrets, do not
leave scratch files in the tree, and do not ask whether you may edit files. You may.

**The sandbox stops after fifteen minutes of inactivity.** Anything not committed goes with it.
Long-running work belongs in the turn, not in a background process you leave behind.

SproutOS runs each deployable target in this repository as its own **project**. A repository with a
web app and a separate API is one repository and two projects, grouped under a parent that holds
them and deploys nothing itself.

## What a deploy actually is

A GitHub Actions workflow builds the target, uploads a zip, and calls the platform. The platform
publishes it as a Lambda version and moves an alias, so a release is atomic and a rollback is one
API call rather than a rebuild.

Add `.github/workflows/sproutos.yml`:

```yaml
name: Deploy to SproutOS
on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write   # required — the deploy authenticates as this repository via OIDC

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MySproutOS/sproutos-deploy-action@v1
        with:
          preset: next            # next | hono | static | android
          directory: apps/website # the target's root, relative to the repository
          project: reddit-clone
          api-url: https://api.sproutos.me
```

**`project` is required when this repository holds more than one project**, and it is the most
common thing to get wrong. Without it the platform cannot tell which of them this workflow deploys
and refuses rather than guessing — a guess would deploy the right code to the wrong service, which
looks exactly like success.

**`id-token: write` is required.** Without it there is no OIDC token, and the deploy fails at the
first step with an authentication error that does not mention permissions.

One workflow per deployable target, each with its own `directory` and `project`.

## Backend services

Databases, caches, search and object storage are provisioned by the platform, not declared in this
repository. Each one is reached through a connection URI injected into the project's environment.

| Kind | Environment variable | Notes |
| --- | --- | --- |
| `postgres` | `DATABASE_URL` | Reached through the SproutOS proxy, never a direct cloud credential |
| `valkey` | `VALKEY_URL` | Redis-compatible; queue clients point here |
| `elasticsearch` | `SEARCH_URL` | Tenant-scoped; index names are rewritten for you |
| `object_storage` | `S3_*` | S3-compatible, SigV4, scoped to your own bucket |

**Never commit a connection URI.** They are issued once, and anything committed is a credential in
a git history. Read them from the environment.

## Environment variables

Set per project and per target (`production`, `preview`, or both). They are encrypted at rest and
delivered to the function as environment variables at publish time.

Because they are baked into a published version, **a rollback restores the environment that version
was published with** — including a secret rotated since. Worth knowing before rolling back.

## Migrations

Migrations run as a separate step *before* the new version starts serving. A failing migration fails
the deploy and leaves the previous release up.

Do not run migrations from application startup. Several Lambda instances start concurrently, and a
migration racing itself is how a schema ends up half-applied.

## Static assets

An SPA's built assets are uploaded separately and served from the CDN rather than through the
function. Use the `static` preset, or `static-paths` alongside a server preset.

Those assets go to a **platform-managed bucket**, keyed by project — this is not your
`object_storage` service. Files your application uploads at runtime belong in the latter.

## What does not run here

There is no long-running process. A background worker that sits in a loop consuming a queue has no
home: functions are request/response and are not running between requests.

Background work is expressed as **workflows** — the platform starts them from a queue and bills only
while they run. Porting a worker means moving each job handler into a workflow step, not finding a
way to keep a process alive.

## Getting it wrong safely

- The tenant hostname for a project is `<slug>-<discriminator>.sproutos.run`. The
  discriminator exists because project names are unique per organisation and hostnames are global.
- A custom domain is added through the dashboard and verified by a TXT record before it serves.
- Renaming a project changes its display name only. It does not rename the repository, and it does
  not change the hostname.

