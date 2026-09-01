import type { TenantCode } from "@/lib/tenant-code/resolve-host"
import type { TenantCodeConfig } from "./types"
import { phTenantCodeConfig } from "./ph"
import { ukTenantCodeConfig } from "./uk"

export type { TenantCodeConfig } from "./types"

const CONFIGS: Record<TenantCode, TenantCodeConfig> = {
  PH: phTenantCodeConfig,
  UK: ukTenantCodeConfig,
}

/** Components should prefer `getTenantCodeConfig(tenantCode).ui.xyz` over inline
 * `tenantCode === "UK" ? ... : ...` branches, so PH/UK presentation can change independently
 * without touching shared components. Defaults to PH when the tenant code is unresolved (e.g.
 * an unauthenticated page on the apex/unknown host) — a display default only, never a legal one. */
export function getTenantCodeConfig(tenantCode: TenantCode | null | undefined): TenantCodeConfig {
  return CONFIGS[tenantCode ?? "PH"]
}
