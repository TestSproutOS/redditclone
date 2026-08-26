#!/usr/bin/env node
/**
 * Bundle the migrator into a Lambda archive.
 *
 * Everything is bundled except `pg-native`, which is an optional native binding `pg` reaches for
 * inside a `try` and does not need. Left unmarked, esbuild tries to resolve it at build time and
 * fails on a dependency the migrator never uses.
 *
 * **CommonJS output, not ESM.** `pg` is CommonJS and calls `require("events")` at load. Bundled into
 * an ESM file, esbuild rewrites that into a shim that throws `Dynamic require of "events" is not
 * supported` — at runtime, on the first invocation, from a file the author never wrote. CJS output
 * keeps `require` meaning what `pg` expects.
 *
 * The migration files are copied rather than bundled: `FileMigrationProvider` reads them from disk
 * by name, so they have to exist as files at the path the handler computes. Bundling them would
 * produce an archive whose migrator finds no migrations and reports success having done nothing —
 * which is the worst possible outcome for this particular program.
 */
import { build } from "esbuild"
import { cp, mkdir, rm } from "node:fs/promises"

const out = "build"
await rm(out, { force: true, recursive: true })
await mkdir(out, { recursive: true })

await build({
  bundle: true,
  entryPoints: ["lambda.ts"],
  external: ["pg-native"],
  format: "cjs",
  outfile: `${out}/index.js`,
  platform: "node",
  target: "node22",
})

await cp("src/migrations", `${out}/migrations`, { recursive: true })
