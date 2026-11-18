import type { TenantCode } from "@/lib/tenant-code/resolve-host"
import type { TenantCodeConfig } from "./types"
import { phTenantCodeConfig } from "./ph"
import { ukTenantCodeConfig } from "./uk"
import { krTenantCodeConfig } from "./kr"

export type { TenantCodeConfig } from "./types"

const CONFIGS: Record<TenantCode, TenantCodeConfig> = {
  PH: phTenantCodeConfig,
  UK: ukTenantCodeConfig,
  KR: krTenantCodeConfig,
}

/** `{ context }` for t() on copy that differs by site (`key_UK`, `key_KR`), or undefined for the
 * plain key. A missing variant falls back to the plain key, so a site can go live before every
 * variant is written. */
export function tenantI18nContext(tenantCode: TenantCode | null | undefined): { context: "UK" | "KR" } | undefined {
  const context = tenantCode ? CONFIGS[tenantCode].i18nContext : null
  return context ? { context } : undefined
}

/** Components should prefer `getTenantCodeConfig(tenantCode).ui.xyz` over inline
 * `tenantCode === "UK" ? ... : ...` branches, so PH/UK presentation can change independently
 * without touching shared components. Defaults to PH when the tenant code is unresolved (e.g.
 * an unauthenticated page on the apex/unknown host) — a display default only, never a legal one. */
export function getTenantCodeConfig(tenantCode: TenantCode | null | undefined): TenantCodeConfig {
  return CONFIGS[tenantCode ?? "PH"]
}

/** i18n keys (create-case namespace) for each `ui.caseIntake.ukJurisdictionOptions` value. */
export const UK_JURISDICTION_LABEL_KEYS: Record<string, string> = {
  "England and Wales": "ukJurisdictions.englandAndWales",
  "Scotland": "ukJurisdictions.scotland",
  "Northern Ireland": "ukJurisdictions.northernIreland",
}
