export type TenantCode = "PH" | "UK"

/**
 * Explicit hostname → Tenant code map. No substring/`.includes()` matching — an unrecognized
 * host (including the bare apex domain and plain `localhost:3002`) always resolves to `null`,
 * never guessed at. Keep in sync with the backend's copy at
 * ilovelawyer-api/src/utils/tenant-host.ts — two separate deployables, no shared package
 * between them (packages/ only has ui/eslint-config/typescript-config).
 *
 * Three host conventions are recognized for local dev, all mapping to the same Tenant code:
 * `ph.ilovelawyer.local` (the spec's required form), and the bare `ph.ilovelawyer` this repo's
 * own `next.config.ts` `allowedDevOrigins` already anticipated before this feature was built
 * (that's what this environment's hosts file actually points at) — plus the `.com` production
 * form.
 */
const HOST_TENANT_CODE_MAP: Record<string, TenantCode> = {
  "ph.ilovelawyer.com": "PH",
  "ph.ilovelawyer.local": "PH",
  "ph.ilovelawyer": "PH",
  "uk.ilovelawyer.com": "UK",
  "uk.ilovelawyer.local": "UK",
  "uk.ilovelawyer": "UK",
}

/** Strips a trailing `:port` (present on `Host` in local dev, e.g. `ph.ilovelawyer.local:3002`)
 * before the exact-match lookup. This is presentation/routing context only — it is never the
 * authority for an authenticated organization's Tenant (see app/(protected)/layout.tsx, which
 * compares this against the organization's persisted tenant and redirects on mismatch rather
 * than trusting the hostname). */
export function resolveTenantCodeFromHost(hostname: string | undefined | null): TenantCode | null {
  if (!hostname) return null
  const host = (hostname.split(":")[0] ?? "").trim().toLowerCase()
  return HOST_TENANT_CODE_MAP[host] ?? null
}

/** The target host for a given Tenant code, used by the tenant switcher and the
 * domain-mismatch redirect. Preserves whichever convention `currentHost` is already using
 * (`.com`, `.local:port`, or the bare `.ilovelawyer:port` dev form) by swapping only the
 * `ph`/`uk` prefix, rather than assuming one fixed shape — so it works regardless of which of
 * the three recognized host conventions the browser is currently on. */
export function hostForTenantCode(tenantCode: TenantCode, currentHost: string): string {
  const suffix = currentHost.replace(/^(ph|uk)\./i, "")
  return `${tenantCode.toLowerCase()}.${suffix}`
}
