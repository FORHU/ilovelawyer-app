import type { TenantCode } from "@/lib/tenant-code/resolve-host"
import type { CapabilityStatus, TenantCapabilities } from "./types"
import { getTenantCodeConfig } from "./index"

export type { CapabilityStatus, TenantCapabilities } from "./types"

export function getTenantCapabilities(tenantCode: TenantCode | null | undefined): TenantCapabilities {
  return getTenantCodeConfig(tenantCode).ui.capabilities
}

/**
 * A feature is usable when its status is anything other than "coming-soon" — provisional and
 * pending-persona features are real, working functionality flagged with a caveat, not gated
 * access. Components that need to render that caveat should read the status directly via
 * getTenantCapabilities instead of this boolean.
 */
export function isFeatureEnabled(
  tenantCode: TenantCode | null | undefined,
  feature: keyof TenantCapabilities,
): boolean {
  return getStatus(tenantCode, feature) !== "coming-soon"
}

export function getStatus(
  tenantCode: TenantCode | null | undefined,
  feature: keyof TenantCapabilities,
): CapabilityStatus {
  return getTenantCapabilities(tenantCode)[feature]
}
