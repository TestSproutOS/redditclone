export function corsOrigin(
  origin: string,
  configuredOrigins: string | undefined,
  nodeEnv: string | undefined,
): string | null {
  if (!origin) return null

  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return null
  }

  if (
    nodeEnv !== "production" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
  ) {
    return origin
  }

  const allowed = new Set(
    (configuredOrigins ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )
  return allowed.has(parsed.origin) ? origin : null
}
