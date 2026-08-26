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
 * The migration files are **compiled one-to-one**, not bundled and not copied.
 *
 * Not bundled, because `FileMigrationProvider` reads them from disk by name: bundling them produces
 * an archive whose migrator finds no migrations and reports success having done nothing, which for
 * this program is the worst available outcome.
 *
 * Not copied, because they are TypeScript. `FileMigrationProvider` `import()`s each file, and Node
 * cannot load a `.ts` file — the failure is "Failed to load the ES module", naming a path, which
 * reads like a missing file rather than an uncompiled one.
 */
import { build } from "esbuild"
import { mkdir, readdir, rm } from "node:fs/promises"

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

const migrations = (await readdir("src/migrations")).filter((name) => name.endsWith(".ts"))
if (migrations.length === 0) {
  // Loud, because a migrator with no migrations is indistinguishable at runtime from one that has
  // nothing left to apply.
  throw new Error("No migrations found in src/migrations; the archive would apply nothing.")
}

await build({
  bundle: true,
  entryPoints: migrations.map((name) => `src/migrations/${name}`),
  external: ["pg-native"],
  format: "cjs",
  outdir: `${out}/migrations`,
  platform: "node",
  target: "node22",
})
console.log(`compiled ${migrations.length} migrations`)
