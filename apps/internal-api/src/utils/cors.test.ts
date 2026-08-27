import { describe, expect, it } from "vitest"
import { corsOrigin } from "./cors"

describe("corsOrigin", () => {
  const configured =
    "https://readit.example.com, https://admin.readit.example.com,https://readit.example.com"

  it("returns an explicitly configured origin", () => {
    expect(corsOrigin("https://readit.example.com", configured, "production")).toBe(
      "https://readit.example.com",
    )
  })

  it("does not trust an arbitrary sibling tenant", () => {
    expect(corsOrigin("https://another-tenant.sproutos.run", configured, "production")).toBeNull()
  })

  it("allows local browser development outside production", () => {
    expect(corsOrigin("http://localhost:3002", undefined, "development")).toBe(
      "http://localhost:3002",
    )
    expect(corsOrigin("http://localhost:3002", undefined, "production")).toBeNull()
  })

  it("rejects malformed origins", () => {
    expect(corsOrigin("not a URL", configured, "production")).toBeNull()
  })
})
