import type { NextResponse } from "next/server"

/** Attach the credential session to the response that actually leaves the Lambda. */
export function attachSessionTokenCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  response.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  })
}
