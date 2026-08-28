import { NextResponse } from "next/server"

/**
 * Returns a browser redirect without resolving it against the Lambda listener address.
 *
 * In production `request.url` names the internal listener (`0.0.0.0:8080`), while the browser
 * must stay on the public website origin. Relative Location values are resolved by the browser
 * against the public response URL.
 */
export function isSafeRelativeRedirect(location: string): boolean {
  if (!location.startsWith("/") || location.includes("\\")) return false
  for (let index = 0; index < location.length; index++) {
    const code = location.charCodeAt(index)
    if (code <= 31 || code === 127) return false
  }

  // WHATWG URL parsing treats backslashes and some stripped control characters as slashes for
  // special schemes. Resolving against a sentinel origin catches authority-form variants rather
  // than trying to enumerate every spelling of `//`.
  const sentinel = new URL("https://redirect.invalid")
  try {
    return new URL(location, sentinel).origin === sentinel.origin
  } catch {
    return false
  }
}

export function relativeRedirect(location: string): NextResponse {
  if (!isSafeRelativeRedirect(location)) {
    throw new Error("redirect location must be a root-relative path")
  }
  return new NextResponse(null, { status: 303, headers: { location } })
}
