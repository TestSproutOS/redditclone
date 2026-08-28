import { crudUser } from "@lib/dao/user/crud"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { createSession, generateSessionToken, setSessionTokenCookie } from "@website/lib/auth"
import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyPasswordOrDummy,
} from "@website/lib/password"
import { isSameOriginRequest } from "@website/lib/same-origin"
import { relativeRedirect } from "@website/lib/relative-redirect"
import { randomUUID } from "node:crypto"

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,24}$/

function destination(formData: FormData): string {
  const next = formData.get("next")
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/"
}

function loginRedirect(message: string, intent: string, next: string): Response {
  const search = new URLSearchParams({ error: message, intent })
  if (next !== "/") search.set("next", next)
  return relativeRedirect(`/login?${search.toString()}`)
}

function isUsernameConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "user_username_lower_key"
  )
}

async function beginSession(userId: string): Promise<void> {
  const sessionToken = generateSessionToken()
  const session = await createSession(sessionToken, userId)
  await setSessionTokenCookie(sessionToken, session.expires)
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return new Response(null, { status: 403 })
  }

  const formData = await request.formData()
  const intent = formData.get("intent") === "sign-in" ? "sign-in" : "register"
  const usernameValue = formData.get("username")
  const passwordValue = formData.get("password")
  const username = typeof usernameValue === "string" ? usernameValue.trim() : ""
  const password = typeof passwordValue === "string" ? passwordValue : ""
  const next = destination(formData)

  if (!USERNAME_PATTERN.test(username)) {
    return loginRedirect(
      "Username must be 3–24 characters using letters, numbers, underscores, or hyphens.",
      intent,
      next,
    )
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return loginRedirect(
      `Password must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`,
      intent,
      next,
    )
  }

  if (intent === "sign-in") {
    const user = await fetchUser(db).getOneByUsername(username, ["id", "passwordHash"])
    if (!(await verifyPasswordOrDummy(password, user?.passwordHash))) {
      return loginRedirect("Incorrect username or password.", intent, next)
    }
    await beginSession(user!.id)
    return relativeRedirect(next)
  }

  if (formData.get("terms") !== "on") {
    return loginRedirect("Please agree to the terms and conditions.", intent, next)
  }

  const passwordHash = await hashPassword(password)
  const sessionToken = generateSessionToken()
  let session: Awaited<ReturnType<typeof createSession>>
  try {
    session = await db.transaction().execute(async (tx) => {
      const user = await crudUser(tx).createUser({
        username,
        name: username,
        // The legacy schema requires an email, but credential users never supply or see one.
        email: `${randomUUID()}@users.invalid`,
        passwordHash,
      })
      return await createSession(sessionToken, user.id, tx)
    })
  } catch (error) {
    if (isUsernameConflict(error)) {
      return loginRedirect("That username is already taken.", intent, next)
    }
    throw error
  }

  await setSessionTokenCookie(sessionToken, session.expires)
  return relativeRedirect(next)
}
