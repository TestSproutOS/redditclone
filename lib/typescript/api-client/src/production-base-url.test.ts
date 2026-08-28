import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { createClient } from "./generated/client"
import type { Client } from "./generated/client"
import { getApiV1AuthMe } from "./generated/sdk.gen"

const workflowPath = path.resolve(
  import.meta.dirname,
  "../../../../.github/workflows/sproutos-reddit-clone-spas.yml",
)

function productionBaseUrl(): string {
  const workflow = fs.readFileSync(workflowPath, "utf8")
  const match = /^  NEXT_PUBLIC_API_URL: (.+)$/m.exec(workflow)
  if (match === null) throw new Error("SPA workflow must define NEXT_PUBLIC_API_URL")
  return JSON.parse(match[1]) as string
}

describe("production SPA API URL", () => {
  it("combines the deployed base with the generated auth path exactly once", () => {
    const get = vi.fn<Client["get"]>()
    void getApiV1AuthMe({ client: { get } as unknown as Client })
    expect(get).toHaveBeenCalledWith(expect.objectContaining({ url: "/api/v1/auth/me" }))

    const [{ url }] = get.mock.calls[0] as [{ url: string }]
    const runtimeClient = createClient({ baseUrl: productionBaseUrl() })
    const runtimeUrl = runtimeClient.buildUrl({ url })

    expect(runtimeUrl).toBe("/api/v1/auth/me")
    expect(runtimeUrl).not.toContain("/api/api/")
  })
})
