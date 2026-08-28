import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"
import type { DB } from "./types"

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)

dotenv.config({ path: `${currentDir}/../../../.env`, quiet: true })

interface PoolErrorSource {
  on(event: "error", listener: (error: Error) => void): unknown
}

/**
 * `pg` emits an `error` event when an idle pooled connection is severed. Without a listener,
 * Node treats that event as an uncaught exception and terminates the whole process. SproutOS moves
 * the Postgres TCP listener during router releases, so a warm Lambda can legitimately lose an idle
 * connection even though the pool can replace it on the next query.
 *
 * This deliberately does not retry queries: replaying an interrupted write could duplicate it.
 * `pg` already removes the failed idle client; keeping the process alive lets the next request get
 * a fresh connection while an active request still receives the original database error.
 */
export function handleIdlePoolErrors(
  source: PoolErrorSource,
  report: (message: string) => void = console.error,
): void {
  source.on("error", (error) => {
    report(
      JSON.stringify({
        level: "error",
        message: "idle database connection was dropped; the pool will reconnect",
        error: error.message,
        code: "code" in error && typeof error.code === "string" ? error.code : undefined,
      }),
    )
  })
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
})
handleIdlePoolErrors(pool)

const dialect = new PostgresDialect({
  pool,
})

export const db = new Kysely<DB>({
  dialect,
  plugins: [new CamelCasePlugin()],
})

export type { DB }
