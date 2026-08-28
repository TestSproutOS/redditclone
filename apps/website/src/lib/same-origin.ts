function firstForwardedValue(value: string | null): string | null {
  const first = value?.split(",", 1)[0]?.trim()
  return first === undefined || first === "" ? null : first
}

/**
 * Checks state-changing browser requests against the public scheme and host.
 *
 * Browsers send Origin on form POSTs. Missing Origin is rejected deliberately: accepting it would
 * make a direct route invocation weaker than the website proxy that normally runs in front of it.
 */
export function isSameOriginRequest(request: Request): boolean {
  const originHeader = request.headers.get("origin")
  if (originHeader === null) return false

  let suppliedOrigin: URL
  try {
    suppliedOrigin = new URL(originHeader)
  } catch {
    return false
  }
  if (suppliedOrigin.protocol !== "http:" && suppliedOrigin.protocol !== "https:") return false
  if (originHeader !== suppliedOrigin.origin) return false

  const requestUrl = new URL(request.url)
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"))
  const host = forwardedHost ?? firstForwardedValue(request.headers.get("host")) ?? requestUrl.host
  const forwardedProtocol = firstForwardedValue(request.headers.get("x-forwarded-proto"))
  const protocol = forwardedProtocol === null ? requestUrl.protocol : `${forwardedProtocol}:`
  if (protocol !== "http:" && protocol !== "https:") return false

  try {
    const expectedOrigin = new URL(`${protocol}//${host}`)
    if (
      expectedOrigin.pathname !== "/" ||
      expectedOrigin.search !== "" ||
      expectedOrigin.hash !== ""
    ) {
      return false
    }
    return suppliedOrigin.origin === expectedOrigin.origin
  } catch {
    return false
  }
}
