import type { Jurisdiction } from "@/lib/jurisdiction/resolve-host"
import type { CapabilityStatus, JurisdictionCapabilities } from "./types"
import { getJurisdictionConfig } from "./index"

export type { CapabilityStatus, JurisdictionCapabilities } from "./types"

export function getJurisdictionCapabilities(jurisdiction: Jurisdiction | null | undefined): JurisdictionCapabilities {
  return getJurisdictionConfig(jurisdiction).ui.capabilities
}

/**
 * A feature is usable when its status is anything other than "coming-soon" — provisional and
 * pending-persona features are real, working functionality flagged with a caveat, not gated
 * access. Components that need to render that caveat should read the status directly via
 * getJurisdictionCapabilities instead of this boolean.
 */
export function isFeatureEnabled(
  jurisdiction: Jurisdiction | null | undefined,
  feature: keyof JurisdictionCapabilities,
): boolean {
  return getStatus(jurisdiction, feature) !== "coming-soon"
}

export function getStatus(
  jurisdiction: Jurisdiction | null | undefined,
  feature: keyof JurisdictionCapabilities,
): CapabilityStatus {
  return getJurisdictionCapabilities(jurisdiction)[feature]
}
