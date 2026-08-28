import { describe, expect, it } from "vitest"
import { relativeRedirect } from "./relative-redirect"
import { attachSessionTokenCookie } from "./session-cookie"

describe("attachSessionTokenCookie", () => {
  it("puts the session on the returned redirect response", () => {
    const response = relativeRedirect("/")
    attachSessionTokenCookie(response, "test-token", new Date("2026-09-01T00:00:00Z"))

    expect(response.headers.get("set-cookie")).toContain("session=test-token")
    expect(response.headers.get("set-cookie")).toContain("Path=/")
    expect(response.headers.get("set-cookie")).toContain("HttpOnly")
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax")
  })
})
