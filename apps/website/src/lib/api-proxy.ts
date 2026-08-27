const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const

function withoutHopByHopHeaders(input: Headers): Headers {
  const headers = new Headers(input)
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name)
  return headers
}

/**
 * Sends the browser's same-origin `/api` request to the separately deployed API.
 *
 * The session cookie is deliberately host-only. Sharing it at `.sproutos.run` would let one
 * tenant overwrite another tenant's cookie, while a custom website and the canonical API do not
 * even have a safe parent domain in common. Keeping the browser on one origin and forwarding the
 * cookie server-side preserves that isolation boundary.
 */
export async function proxyApiRequest(
  request: Request,
  route: string[],
  upstreamBase = process.env.NEXT_PUBLIC_API_UPSTREAM_URL,
): Promise<Response> {
  if (upstreamBase === undefined || upstreamBase.trim() === "") {
    return Response.json({ error: "API upstream is not configured" }, { status: 503 })
  }

  const requestUrl = new URL(request.url)
  const target = new URL(upstreamBase)
  const basePath = target.pathname.replace(/\/$/, "")
  const suffix = route.map((segment) => encodeURIComponent(segment)).join("/")
  target.pathname = suffix === "" ? basePath : `${basePath}/${suffix}`
  target.search = requestUrl.search

  const headers = withoutHopByHopHeaders(request.headers)
  headers.delete("host")
  headers.delete("content-length")
  headers.set("x-forwarded-host", requestUrl.host)
  headers.set("x-forwarded-proto", requestUrl.protocol.replace(/:$/, ""))

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: withoutHopByHopHeaders(response.headers),
  })
}
