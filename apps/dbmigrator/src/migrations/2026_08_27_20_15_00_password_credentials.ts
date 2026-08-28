import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("user").addColumn("password_hash", "text").execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("user").dropColumn("password_hash").execute()
}
