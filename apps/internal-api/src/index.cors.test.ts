import { afterEach, describe, expect, it } from "vitest"
import app from "./index"

const previousOrigins = process.env.CORS_ALLOWED_ORIGINS

afterEach(() => {
  if (previousOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS
  else process.env.CORS_ALLOWED_ORIGINS = previousOrigins
})

describe("API CORS", () => {
  it("answers an allowed SPA preflight before auth middleware", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://readit.example.com"

    const response = await app.request("/api/v1/auth/me", {
      method: "OPTIONS",
      headers: {
        Origin: "https://readit.example.com",
        "Access-Control-Request-Method": "GET",
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe("https://readit.example.com")
    expect(response.headers.get("access-control-allow-credentials")).toBe("true")
  })

  it("does not emit an allow-origin header for another tenant", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://readit.example.com"

    const response = await app.request("/api/v1/auth/me", {
      method: "OPTIONS",
      headers: {
        Origin: "https://another-tenant.sproutos.run",
        "Access-Control-Request-Method": "GET",
      },
    })

    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })
})
