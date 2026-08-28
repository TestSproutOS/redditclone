import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto"

const KEY_LENGTH = 32
const SALT_LENGTH = 16
const SCRYPT_N = 16_384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 128

// Used when a username does not exist so sign-in still performs the same expensive KDF.
const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$00000000000000000000000000000000$208780823df3bfa18f641b32f8e635b9a3c14b5ba650ba28204a533865fb8f88"

function scryptOptions(n: number, r: number, p: number) {
  return { N: n, r, p, maxmem: SCRYPT_MAX_MEMORY }
}

function deriveKey(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      length,
      scryptOptions(SCRYPT_N, SCRYPT_R, SCRYPT_P),
      (error, derived) => {
        if (error) reject(error)
        else resolve(derived)
      },
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await deriveKey(password, salt, KEY_LENGTH)
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$")
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$")
  if (parts.length !== 6 || parts[0] !== "scrypt") return false

  const [, nText, rText, pText, saltHex, expectedHex] = parts
  const n = Number(nText)
  const r = Number(rText)
  const p = Number(pText)
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false
  if (!/^[0-9a-f]{32}$/i.test(saltHex) || !/^[0-9a-f]{64}$/i.test(expectedHex)) return false

  const expected = Buffer.from(expectedHex, "hex")
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"), expected.length)
  return timingSafeEqual(actual, expected)
}

export async function verifyPasswordOrDummy(
  password: string,
  encoded: string | null | undefined,
): Promise<boolean> {
  const candidate = encoded ?? DUMMY_PASSWORD_HASH
  const valid = await verifyPassword(password, candidate)
  return encoded !== null && encoded !== undefined && valid
}
