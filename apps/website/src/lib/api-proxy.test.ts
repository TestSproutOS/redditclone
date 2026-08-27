import { afterEach, describe, expect, it, vi } from "vitest"
import { proxyApiRequest } from "./api-proxy"

afterEach(() => vi.restoreAllMocks())

describe("proxyApiRequest", () => {
  it("forwards the route, query, session cookie and request body to the separate API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("stored", {
        status: 201,
        headers: { connection: "close", "x-upstream": "yes" },
      }),
    )
    const request = new Request("https://www.textscam.com/api/v1/media/upload?key=a%2Fb.png", {
      method: "PUT",
      headers: {
        connection: "keep-alive",
        cookie: "session=test-token",
        "content-type": "image/png",
        host: "www.textscam.com",
      },
      body: new Uint8Array([1, 2, 3]),
    })

    const response = await proxyApiRequest(
      request,
      ["v1", "media", "upload"],
      "https://reddit-clone-api-834f87.sproutos.run/api",
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const [target, init] = fetchMock.mock.calls[0]
    expect(target).toBeInstanceOf(URL)
    expect((target as URL).href).toBe(
      "https://reddit-clone-api-834f87.sproutos.run/api/v1/media/upload?key=a%2Fb.png",
    )
    expect(init?.method).toBe("PUT")
    const headers = new Headers(init?.headers)
    expect(headers.get("cookie")).toBe("session=test-token")
    expect(headers.get("host")).toBeNull()
    expect(headers.get("connection")).toBeNull()
    expect(headers.get("x-forwarded-host")).toBe("www.textscam.com")
    expect(Array.from(new Uint8Array(init?.body as ArrayBuffer))).toEqual([1, 2, 3])
    expect(response.status).toBe(201)
    expect(response.headers.get("x-upstream")).toBe("yes")
    expect(response.headers.get("connection")).toBeNull()
    expect(await response.text()).toBe("stored")
  })

  it("does not send a body for GET and fails closed without an upstream", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"))
    await proxyApiRequest(
      new Request("https://redditclone-web-938433.sproutos.run/api/v1/posts"),
      ["v1", "posts"],
      "https://api.example.test/api/",
    )
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined()

    const missing = await proxyApiRequest(
      new Request("https://www.textscam.com/api/v1/posts"),
      ["v1", "posts"],
      " ",
    )
    expect(missing.status).toBe(503)
  })
})
