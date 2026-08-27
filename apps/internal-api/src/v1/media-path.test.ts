import { describe, expect, it } from "vitest"
import { isPublicMediaKey, mimeTypeForImageKey } from "./media-path"

const id = "019d3c73-14de-7b59-8851-b67587af3c18"

describe("media object paths", () => {
  it("accepts only known public media namespaces", () => {
    expect(isPublicMediaKey(`post-media/${id}/0-abc.png`)).toBe(true)
    expect(isPublicMediaKey(`link-preview/${id}/abc.webp`)).toBe(true)
    expect(isPublicMediaKey(`private/${id}/secret.txt`)).toBe(false)
    expect(isPublicMediaKey(`post-media/${id}/../secret`)).toBe(false)
    expect(isPublicMediaKey("post-media/not-an-id/file.png")).toBe(false)
  })

  it("derives the allowed image MIME type from the issued key", () => {
    expect(mimeTypeForImageKey(`user-avatar/${id}/abc.jpg`)).toBe("image/jpeg")
    expect(mimeTypeForImageKey(`user-avatar/${id}/abc.png`)).toBe("image/png")
    expect(mimeTypeForImageKey(`user-avatar/${id}/abc.exe`)).toBeNull()
  })
})
