import { describe, expect, it } from "vitest"
import { hashPassword, verifyPassword, verifyPasswordOrDummy } from "./password"

describe("password hashing", () => {
  it("hashes with a unique salt and verifies only the original password", async () => {
    const first = await hashPassword("correct horse battery staple")
    const second = await hashPassword("correct horse battery staple")

    expect(first).not.toBe(second)
    await expect(verifyPassword("correct horse battery staple", first)).resolves.toBe(true)
    await expect(verifyPassword("wrong password", first)).resolves.toBe(false)
  })

  it("rejects malformed and unsupported hashes", async () => {
    await expect(verifyPassword("password", "not-a-hash")).resolves.toBe(false)
    await expect(
      verifyPassword(
        "password",
        "scrypt$2$8$1$00000000000000000000000000000000$208780823df3bfa18f641b32f8e635b9a3c14b5ba650ba28204a533865fb8f88",
      ),
    ).resolves.toBe(false)
  })

  it("runs the dummy verification path for users without a password", async () => {
    await expect(verifyPasswordOrDummy("password", null)).resolves.toBe(false)
  })
})
