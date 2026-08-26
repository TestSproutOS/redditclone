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
 * CommonJS output, because `pg` and its siblings are CommonJS and call `require` at load. In an ESM
 * bundle esbuild rewrites those into a shim that throws `Dynamic require of "events" is not
 * supported` on the first invocation.
 *
 * `pg-native` stays external: an optional native binding `pg` reaches for inside a `try` and does
 * not need. Left unmarked, the build fails on a dependency nothing uses.
 */
import { build } from "esbuild"

await build({
  bundle: true,
  entryPoints: ["src/server.ts"],
  external: ["pg-native"],
  format: "cjs",
  outfile: "build/server.js",
  platform: "node",
  target: "node22",
})
