export type SpaName = "dashboard" | "admin"

const DEFAULT_ORIGINS: Record<SpaName, string> = {
  dashboard: "https://reddit-clone-dashboard-4104ab.sproutos.run",
  admin: "https://reddit-clone-admin-d337a7.sproutos.run",
}

const ENVIRONMENT_VARIABLES: Record<SpaName, "DASHBOARD_SPA_ORIGIN" | "ADMIN_SPA_ORIGIN"> = {
  dashboard: "DASHBOARD_SPA_ORIGIN",
  admin: "ADMIN_SPA_ORIGIN",
}

/**
 * Resolve one of this customer's two fixed static applications.
 *
 * The value must be an HTTPS origin, not a URL prefix. Request data never enters this function,
 * so the website proxy cannot be turned into an arbitrary upstream proxy.
 */
export function spaOrigin(name: SpaName): string {
  const variable = ENVIRONMENT_VARIABLES[name]
  const configured = process.env[variable] ?? DEFAULT_ORIGINS[name]

  let parsed: URL
  try {
    parsed = new URL(configured)
  } catch {
    throw new Error(`${variable} must be an HTTPS origin`)
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error(`${variable} must be an HTTPS origin`)
  }

  return parsed.origin
}
