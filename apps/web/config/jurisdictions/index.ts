import type { Jurisdiction } from "@/lib/jurisdiction/resolve-host"
import type { JurisdictionConfig } from "./types"
import { phJurisdictionConfig } from "./ph"
import { ukJurisdictionConfig } from "./uk"

export type { JurisdictionConfig } from "./types"

const CONFIGS: Record<Jurisdiction, JurisdictionConfig> = {
  PH: phJurisdictionConfig,
  UK: ukJurisdictionConfig,
}

/** Components should prefer `getJurisdictionConfig(jurisdiction).ui.xyz` over inline
 * `jurisdiction === "UK" ? ... : ...` branches, so PH/UK presentation can change independently
 * without touching shared components. Defaults to PH when jurisdiction is unresolved (e.g. an
 * unauthenticated page on the apex/unknown host) — a display default only, never a legal one. */
export function getJurisdictionConfig(jurisdiction: Jurisdiction | null | undefined): JurisdictionConfig {
  return CONFIGS[jurisdiction ?? "PH"]
}
