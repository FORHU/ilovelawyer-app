export type Jurisdiction = "PH" | "UK"

/**
 * Explicit hostname → jurisdiction map. No substring/`.includes()` matching — an unrecognized
 * host (including the bare apex domain and plain `localhost:3002`) always resolves to `null`,
 * never guessed at. Keep in sync with the backend's copy at
 * ilovelawyer-api/src/utils/jurisdiction-host.ts — two separate deployables, no shared package
 * between them (packages/ only has ui/eslint-config/typescript-config).
 *
 * Four host conventions are recognized for local dev, all mapping to the same jurisdiction:
 * `ph.ilovelawyer.local` (the spec's required form), the bare `ph.ilovelawyer` this repo's
 * own `next.config.ts` `allowedDevOrigins` already anticipated before this feature was built
 * (that's what this environment's hosts file actually points at), and `ph.localhost` (browsers
 * resolve any `*.localhost` subdomain to 127.0.0.1 without a hosts file entry, so this needs no
 * local setup) — plus the `.com` production form. Port is stripped before matching, so `:3002`
 * works on any of them.
 */
const HOST_JURISDICTION_MAP: Record<string, Jurisdiction> = {
  "ph.ilovelawyer.com": "PH",
  "ph.ilovelawyer.local": "PH",
  "ph.ilovelawyer": "PH",
  "ph.localhost": "PH",
  "uk.ilovelawyer.com": "UK",
  "uk.ilovelawyer.local": "UK",
  "uk.ilovelawyer": "UK",
  "uk.localhost": "UK",
}

/** `app.ilovelawyer.com` (and its local-dev equivalents) is a jurisdiction-neutral entry point —
 * it runs standalone, parallel to `ph.ilovelawyer.com`/`uk.ilovelawyer.com`, not a fallback of
 * them. Listed explicitly so the domain-mismatch redirect (app/(protected)/layout.tsx) can
 * recognize it and skip redirecting away from it, instead of treating it as an unresolved host
 * and bouncing users onto a `ph.`/`uk.` subdomain. */
const APP_HOSTS = new Set(["app.ilovelawyer.com", "app.ilovelawyer.local", "app.ilovelawyer", "app.localhost"])

export function isAppHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false
  const host = (hostname.split(":")[0] ?? "").trim().toLowerCase()
  return APP_HOSTS.has(host)
}

/** Strips a trailing `:port` (present on `Host` in local dev, e.g. `ph.ilovelawyer.local:3002`)
 * before the exact-match lookup. This is presentation/routing context only — it is never the
 * authority for an authenticated organization's legal jurisdiction (see
 * app/(protected)/layout.tsx, which compares this against the organization's persisted
 * jurisdiction and redirects on mismatch rather than trusting the hostname). */
export function resolveJurisdictionFromHost(hostname: string | undefined | null): Jurisdiction | null {
  if (!hostname) return null
  const host = (hostname.split(":")[0] ?? "").trim().toLowerCase()
  return HOST_JURISDICTION_MAP[host] ?? null
}

/** The target host for a given jurisdiction, used by the jurisdiction switcher and the
 * domain-mismatch redirect. Preserves whichever convention `currentHost` is already using
 * (`.com`, `.local:port`, or the bare `.ilovelawyer:port` dev form) by swapping only the
 * `ph`/`uk` prefix, rather than assuming one fixed shape — so it works regardless of which of
 * the three recognized host conventions the browser is currently on. */
export function hostForJurisdiction(jurisdiction: Jurisdiction, currentHost: string): string {
  const suffix = currentHost.replace(/^(ph|uk)\./i, "")
  return `${jurisdiction.toLowerCase()}.${suffix}`
}
