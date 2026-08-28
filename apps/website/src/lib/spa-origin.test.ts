import { afterEach, describe, expect, it, vi } from "vitest"
import { spaOrigin } from "./spa-origin"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("spaOrigin", () => {
  it("uses the verified customer static-project origins by default", () => {
    vi.stubEnv("DASHBOARD_SPA_ORIGIN", undefined)
    vi.stubEnv("ADMIN_SPA_ORIGIN", undefined)

    expect(spaOrigin("dashboard")).toBe("https://reddit-clone-dashboard-4104ab.sproutos.run")
    expect(spaOrigin("admin")).toBe("https://reddit-clone-admin-d337a7.sproutos.run")
  })

  it("accepts an explicit HTTPS origin", () => {
    vi.stubEnv("DASHBOARD_SPA_ORIGIN", "https://dashboard.example")
    expect(spaOrigin("dashboard")).toBe("https://dashboard.example")
  })

  it.each([
    "http://dashboard.example",
    "https://dashboard.example/path",
    "https://dashboard.example?upstream=https://attacker.example",
    "https://user:password@dashboard.example",
    "not a URL",
  ])("rejects a non-origin upstream: %s", (value) => {
    vi.stubEnv("DASHBOARD_SPA_ORIGIN", value)
    expect(() => spaOrigin("dashboard")).toThrow("DASHBOARD_SPA_ORIGIN must be an HTTPS origin")
  })
})
