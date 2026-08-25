import type { Jurisdiction } from "@/lib/jurisdiction/resolve-host"

/**
 * Per-jurisdiction feature availability. Mirrors what the backend's registry-selector pattern
 * (ilovelawyer-api's prompt-registry.ts, deadline-engine.registry.ts, legal-knowledge.registry.ts)
 * already enforces server-side — this is a presentation-layer reflection of that reality, not a
 * separate source of truth. Keep in sync with those registries; don't invent a status here that
 * the backend doesn't actually back up.
 *
 * - "available": fully working, no caveats.
 * - "available-provisional": real, working functionality that is explicitly unvalidated/pending
 *   legal review (backend marks this LEGAL_REVIEW_REQUIRED) — shown, not hidden, with a badge.
 * - "pending-persona": the feature works but its AI grounding isn't jurisdiction-aware yet.
 * - "coming-soon": not implemented for this jurisdiction yet; gated from the UI.
 */
export type CapabilityStatus = "available" | "available-provisional" | "pending-persona" | "coming-soon"

export interface JurisdictionCapabilities {
  aiChat: CapabilityStatus
  cases: CapabilityStatus
  documents: CapabilityStatus
  /** Corpus-backed browse/search — the Legal Library. */
  legalSearch: CapabilityStatus
  /** legalRagId-based citation checking in the Legal Terminal. */
  citations: CapabilityStatus
  deadlines: CapabilityStatus
}

/**
 * Presentation-only configuration: UI copy, branding, locale/formatting. Never legal content
 * (deadlines, court rules, statutes, procedural rules) — that lives entirely in the backend's
 * legal/ layer (ilovelawyer-api/src/legal), selected by the organization's persisted
 * jurisdiction, never by this frontend config.
 */
export interface JurisdictionConfig {
  code: Jurisdiction
  displayName: string
  countryName: string
  locale: string
  branding: {
    flag: string
  }
  ui: {
    jurisdictionLabel: string
    organizationLabel: string
    /** Whether to show the PH-only static statute library (civil-code, labor-code, etc.) in
     * navigation — there is no UK equivalent content yet, so this stays false for UK. */
    showPhilippineStatutoryLibrary: boolean
    capabilities: JurisdictionCapabilities
  }
}
