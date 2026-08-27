import { client } from "./generated/client.gen"
import { client as adminClient } from "./admin-generated/client.gen"

declare const process: { env: { NODE_ENV?: string; NEXT_PUBLIC_API_URL?: string } }

export * from "./generated/client.gen"
export * from "./generated/types.gen"
export * from "./generated/sdk.gen"

export const baseUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : (process.env.NEXT_PUBLIC_API_URL ?? "")

client.setConfig({ baseUrl, credentials: "include" })
adminClient.setConfig({ baseUrl, credentials: "include" })
