/**
 * Returns a browser redirect without resolving it against the Lambda listener address.
 *
 * In production `request.url` names the internal listener (`0.0.0.0:8080`), while the browser
 * must stay on the public website origin. Relative Location values are resolved by the browser
 * against the public response URL.
 */
export function relativeRedirect(location: string): Response {
  if (!location.startsWith("/") || location.startsWith("//")) {
    throw new Error("redirect location must be a root-relative path")
  }
  return new Response(null, { status: 303, headers: { location } })
}
