import { describe, expect, it } from "vitest"
import { isSafeRelativeRedirect, relativeRedirect } from "./relative-redirect"

describe("relativeRedirect", () => {
  it("keeps the Location relative to the browser's public origin", () => {
    const response = relativeRedirect("/after-registration")

    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe("/after-registration")
  })

  it("rejects absolute, scheme-relative, and browser-normalized authority destinations", () => {
    const message = "redirect location must be a root-relative path"
    expect(() => relativeRedirect("https://attacker.example")).toThrow(message)
    expect(() => relativeRedirect("//attacker.example")).toThrow(message)
    expect(() => relativeRedirect("/\\attacker.example")).toThrow(message)
    expect(() => relativeRedirect("/\t/attacker.example")).toThrow(message)
  })

  it("demonstrates why backslashes cannot be accepted as an ordinary path character", () => {
    expect(new URL("/\\attacker.example", "https://readit.example").origin).toBe(
      "https://attacker.example",
    )
  })

  it("accepts root-relative paths with queries and fragments", () => {
    expect(isSafeRelativeRedirect("/popular?sort=new#feed")).toBe(true)
  })
})
