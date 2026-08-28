import { describe, expect, it } from "vitest"
import { isSameOriginRequest } from "./same-origin"

function request(origin?: string, headers: Record<string, string> = {}): Request {
  return new Request("https://internal-lambda.example/login/credentials", {
    method: "POST",
    headers: {
      ...(origin === undefined ? {} : { origin }),
      ...headers,
    },
  })
}

describe("isSameOriginRequest", () => {
  it("accepts an exact direct origin", () => {
    expect(isSameOriginRequest(request("https://internal-lambda.example"))).toBe(true)
  })

  it("uses the public forwarded scheme and host behind the platform router", () => {
    expect(
      isSameOriginRequest(
        request("https://readit.example", {
          "x-forwarded-host": "readit.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(true)
  })

  it("rejects missing, malformed, cross-host, and cross-scheme origins", () => {
    expect(isSameOriginRequest(request())).toBe(false)
    expect(isSameOriginRequest(request("not a URL"))).toBe(false)
    expect(isSameOriginRequest(request("https://internal-lambda.example/path"))).toBe(false)
    expect(isSameOriginRequest(request("https://attacker.example"))).toBe(false)
    expect(isSameOriginRequest(request("http://internal-lambda.example"))).toBe(false)
  })

  it("rejects malformed forwarded authority values", () => {
    expect(
      isSameOriginRequest(
        request("https://readit.example", {
          "x-forwarded-host": "readit.example/path",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(false)
    expect(
      isSameOriginRequest(
        request("https://readit.example", {
          "x-forwarded-host": "readit.example",
          "x-forwarded-proto": "javascript",
        }),
      ),
    ).toBe(false)
  })
})
