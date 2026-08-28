import { describe, expect, it } from "vitest"
import { relativeRedirect } from "./relative-redirect"

describe("relativeRedirect", () => {
  it("keeps the Location relative to the browser's public origin", () => {
    const response = relativeRedirect("/after-registration")

    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe("/after-registration")
  })

  it("rejects absolute and scheme-relative destinations", () => {
    expect(() => relativeRedirect("https://attacker.example")).toThrow()
    expect(() => relativeRedirect("//attacker.example")).toThrow()
  })
})
