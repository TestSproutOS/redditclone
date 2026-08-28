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
import { randomUUID } from "node:crypto"

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,24}$/

function destination(formData: FormData): string {
  const next = formData.get("next")
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/"
}

function loginRedirect(request: Request, message: string, intent: string, next: string): Response {
  const target = new URL("/login", request.url)
  target.searchParams.set("error", message)
  target.searchParams.set("intent", intent)
  if (next !== "/") target.searchParams.set("next", next)
  return Response.redirect(target, 303)
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
  const formData = await request.formData()
  const intent = formData.get("intent") === "sign-in" ? "sign-in" : "register"
  const usernameValue = formData.get("username")
  const passwordValue = formData.get("password")
  const username = typeof usernameValue === "string" ? usernameValue.trim() : ""
  const password = typeof passwordValue === "string" ? passwordValue : ""
  const next = destination(formData)

  if (!USERNAME_PATTERN.test(username)) {
    return loginRedirect(
      request,
      "Username must be 3–24 characters using letters, numbers, underscores, or hyphens.",
      intent,
      next,
    )
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return loginRedirect(
      request,
      `Password must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`,
      intent,
      next,
    )
  }

  if (intent === "sign-in") {
    const user = await fetchUser(db).getOneByUsername(username, ["id", "passwordHash"])
    if (!(await verifyPasswordOrDummy(password, user?.passwordHash))) {
      return loginRedirect(request, "Incorrect username or password.", intent, next)
    }
    await beginSession(user!.id)
    return Response.redirect(new URL(next, request.url), 303)
  }

  if (formData.get("terms") !== "on") {
    return loginRedirect(request, "Please agree to the terms and conditions.", intent, next)
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
      return loginRedirect(request, "That username is already taken.", intent, next)
    }
    throw error
  }

  await setSessionTokenCookie(sessionToken, session.expires)
  return Response.redirect(new URL(next, request.url), 303)
}
