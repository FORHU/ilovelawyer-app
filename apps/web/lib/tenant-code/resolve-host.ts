/** Every Tenant code this frontend knows. Keep in sync with ilovelawyer-api's
 * src/types/tenant-code.ts. */
export const TENANT_CODES = ["PH", "UK", "KR"] as const

export type TenantCode = (typeof TENANT_CODES)[number]

/** Narrows an untrusted string (a header, a cookie) to a known Tenant code. */
export function isTenantCode(value: unknown): value is TenantCode {
  return TENANT_CODES.includes(value as TenantCode)
}

/**
 * Explicit hostname → Tenant code map. No substring/`.includes()` matching — an unrecognized
 * host (including the bare apex domain and plain `localhost:3002`) always resolves to `null`,
 * never guessed at. Keep in sync with the backend's copy at
 * ilovelawyer-api/src/utils/tenant-host.ts — two separate deployables, no shared package
 * between them (packages/ only has ui/eslint-config/typescript-config).
 *
 * Four host conventions are recognized for local dev, all mapping to the same Tenant code:
 * `ph.ilovelawyer.local` (the spec's required form), the bare `ph.ilovelawyer` this repo's
 * own `next.config.ts` `allowedDevOrigins` already anticipated before this feature was built
 * (that's what this environment's hosts file actually points at), and `ph.localhost` (browsers
 * resolve any `*.localhost` subdomain to 127.0.0.1 without a hosts file entry, so this needs no
 * local setup) — plus the `.com` production form, the `-dev.ilovelawyer.com` hosted dev
 * environment, and its `-dev.ilovelawyer.local` local-dev counterpart (`ph-dev.ilovelawyer.com` /
 * `uk-dev.ilovelawyer.com` / `ph-dev.ilovelawyer.local` / `uk-dev.ilovelawyer.local`). Port is
 * stripped before matching, so `:3002` works on any of them.
 *
 * `ph-local.ilovelawyer.com` / `uk-local.ilovelawyer.com` are local dev too — pointed at
 * 127.0.0.1 in the hosts file and served over https — because Google sign-in rejects every
 * other local form as a JavaScript origin (it allows plain http only for `localhost`, and
 * `.local` / bare `.ilovelawyer` aren't public TLDs). Use these to test Google SSO locally.
 */
const HOST_TENANT_CODE_MAP: Record<string, TenantCode> = {
  "ph.ilovelawyer.com": "PH",
  "ph-dev.ilovelawyer.com": "PH",
  "ph.ilovelawyer.local": "PH",
  "ph-dev.ilovelawyer.local": "PH",
  "ph-local.ilovelawyer.com": "PH",
  "ph.ilovelawyer": "PH",
  "ph.localhost": "PH",
  "uk.ilovelawyer.com": "UK",
  "uk-dev.ilovelawyer.com": "UK",
  "uk.ilovelawyer.local": "UK",
  "uk-dev.ilovelawyer.local": "UK",
  "uk-local.ilovelawyer.com": "UK",
  "uk.ilovelawyer": "UK",
  "uk.localhost": "UK",
  // Korea: prod kr.ilovelawyer.com, hosted dev kr-dev.ilovelawyer.com, local
  // http://kr-dev.ilovelawyer.local:3002 — plus the same extra dev forms PH and UK have.
  "kr.ilovelawyer.com": "KR",
  "kr-dev.ilovelawyer.com": "KR",
  "kr.ilovelawyer.local": "KR",
  "kr-dev.ilovelawyer.local": "KR",
  "kr-local.ilovelawyer.com": "KR",
  "kr.ilovelawyer": "KR",
  "kr.localhost": "KR",
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

/** Local dev hosts (`ph.localhost:3002`, `ph.ilovelawyer.local:3002`, bare `ph.ilovelawyer:3002`)
 * are the only ones ever served over plain HTTP — matches the dev-host conventions documented
 * above. Shared by anything that needs to build an absolute URL from a bare `Host` header. */
export function protocolForHost(host: string): "http" | "https" {
  return /(localhost|\.local)(:|$)/i.test(host) ? "http" : "https"
}

/** The target host for a given Tenant code, used by the tenant switcher and the
 * domain-mismatch redirect. Preserves whichever convention `currentHost` is already using
 * (`.com`, `-dev.ilovelawyer.com`, `.local:port`, or the bare `.ilovelawyer:port` dev form) by
 * swapping only the `ph`/`uk`/`kr`/`app` prefix (keeping a trailing `-dev` if present), rather than
 * assuming one fixed shape — so it works regardless of which of the recognized host conventions
 * the browser is currently on, including the bare apex (no prefix to strip) and `app.` (no
 * longer exempt from the mismatch redirect — see app/(protected)/layout.tsx). */
export function hostForTenantCode(tenantCode: TenantCode, currentHost: string): string {
  const prefixMatch = currentHost.match(/^(?:ph|uk|kr|app)(-dev|-local)?\./i)
  const devSuffix = prefixMatch?.[1] ?? ""
  const suffix = currentHost.replace(/^(?:ph|uk|kr|app)(?:-dev|-local)?\./i, "")
  return `${tenantCode.toLowerCase()}${devSuffix}.${suffix}`
}
