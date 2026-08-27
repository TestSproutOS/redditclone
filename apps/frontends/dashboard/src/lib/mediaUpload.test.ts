import { afterEach, describe, expect, it, vi } from "vitest"
import { uploadToApi, validateMediaFile } from "./mediaUpload"

class FakeXmlHttpRequest {
  static latest: FakeXmlHttpRequest | null = null
  method = ""
  url = ""
  withCredentials = false
  headers = new Map<string, string>()
  body: File | Blob | null = null
  status = 200
  upload = {
    addEventListener: vi.fn<(name: string, handler: (event: ProgressEvent) => void) => void>(),
  }
  listeners = new Map<string, () => void>()

  constructor() {
    FakeXmlHttpRequest.latest = this
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value)
  }

  addEventListener(name: string, handler: () => void) {
    this.listeners.set(name, handler)
  }

  send(body: File | Blob) {
    this.body = body
    this.listeners.get("load")?.()
  }
}

describe("application media upload", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeXmlHttpRequest.latest = null
  })

  it("sends the raw file with credentials to the authenticated API", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest)
    const body = new Blob(["png"], { type: "image/png" })

    await uploadToApi({ url: "https://api.example.test/media/upload?key=a" }, body)

    expect(FakeXmlHttpRequest.latest?.method).toBe("PUT")
    expect(FakeXmlHttpRequest.latest?.withCredentials).toBe(true)
    expect(FakeXmlHttpRequest.latest?.headers.get("Content-Type")).toBe("image/png")
    expect(FakeXmlHttpRequest.latest?.body).toBe(body)
  })

  it("refuses files larger than the Lambda-safe transfer limit", () => {
    const file = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    })
    expect(validateMediaFile(file)).toContain("4MB")
  })
})
