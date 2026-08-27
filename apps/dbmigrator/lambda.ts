import { Kysely, PostgresDialect } from "kysely"
// Kysely 0.29 moved the migration API to its own entry point; importing these from the root
// resolves and then fails at build with "no matching export", which reads like a version mismatch.
import { FileMigrationProvider, Migrator } from "kysely/migration"
import { promises as fs } from "node:fs"
import * as path from "node:path"
import { Pool } from "pg"

/**
 * The migrator, as a Lambda.
 *
 * SproutOS runs this to completion *before* the new release takes traffic, so code never ships
 * ahead of the schema it expects. It is a separate function from the one that serves requests —
 * a different entry point and a different dependency set — rather than a code path inside the app,
 * which would ship migration tooling into every cold start forever.
 *
 * Bundled with the migration files beside it, so `FileMigrationProvider` reads from the archive
 * rather than from a workspace that does not exist here.
 */
export async function handler(): Promise<{ results: string[] }> {
  const connectionString = process.env.DATABASE_URL
  if (connectionString === undefined || connectionString === "") {
    // Named, because the alternative is `pg` failing to parse `undefined` and reporting a
    // connection error that says nothing about configuration.
    throw new Error("DATABASE_URL is not set on this project, so there is nothing to migrate.")
  }

  const db = new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString, ssl: { rejectUnauthorized: false } }),
    }),
  })

  try {
    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        // `__dirname`, because this is bundled to CommonJS — see `build.mjs`. Relative to the file
        // rather than to `process.cwd()`, which on Lambda is `/var/task` only by convention.
        migrationFolder: path.join(__dirname, "migrations"),
      }),
    })

    const { error, results } = await migrator.migrateToLatest()

    /*
      Every migration is reported, applied or not, and only then is the failure thrown.

      A migration run that fails partway has *done* something, and the deploy that reads this needs
      to know which ones landed. Throwing first would leave a half-applied schema whose only record
      is a stack trace.
    */
    const lines = (results ?? []).map(
      (result) => `${result.status}: ${result.migrationName} (${result.direction})`,
    )
    if (error !== undefined) {
      const message = error instanceof Error ? error.message : "Unknown migration error"
      throw new Error(`${lines.join("\n")}\n${message}`)
    }
    return { results: lines }
  } finally {
    await db.destroy()
  }
}
