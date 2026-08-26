#!/usr/bin/env node
/**
 * Bundle the API into one self-contained file.
 *
 * **Everything is bundled, including npm dependencies.** A container image carried `node_modules`
 * beside the entry point; a Lambda archive is the whole filesystem, so anything left external is
 * simply absent. The symptom is `ERR_MODULE_NOT_FOUND: Cannot find package '@hono/node-server'`
 * from a file that plainly imports it — which reads like a broken install rather than a packaging
 * decision.
 *
 * **ESM output with a `require` shim**, which is the only shape that satisfies both halves of a
 * mixed dependency graph.
 *
 * CommonJS output fails the other way: esbuild has no `import.meta.url` in a CJS file, so a
 * dependency calling `fileURLToPath(import.meta.url)` — several do — receives `undefined` and
 * throws `The "path" argument must be of type string`, from a line number in a bundle nobody wrote.
 *
 * ESM output alone fails too: `pg` and its siblings are CommonJS and `require` at load, which
 * esbuild rewrites into a shim that throws `Dynamic require of "events" is not supported`.
 *
 * The banner gives the bundle a real `require`, built from this module's own URL, so both work.
 *
 * `pg-native` stays external: an optional native binding `pg` reaches for inside a `try` and does
 * not need. Left unmarked, the build fails on a dependency nothing uses.
 */
import { build } from "esbuild"
import { writeFile } from "node:fs/promises"

await build({
  bundle: true,
  entryPoints: ["src/server.ts"],
  external: ["pg-native"],
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      'const require = __createRequire(import.meta.url);',
    ].join("\n"),
  },
  format: "esm",
  outfile: "build/server.js",
  platform: "node",
  target: "node22",
})

/*
  The archive is its own package, and has to say so.

  A Lambda archive is unpacked at `/var/task` with nothing above it, so the `"type": "module"` in
  this app's own package.json is not there. Node then reads `server.js` as CommonJS, and an ESM
  bundle fails on its first `import` with a syntax error that points at valid code.
*/
await writeFile("build/package.json", `${JSON.stringify({ type: "module" }, null, 2)}\n`)
