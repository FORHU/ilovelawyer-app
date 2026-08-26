import type { JurisdictionConfig } from "./types"

export const ukJurisdictionConfig: JurisdictionConfig = {
  code: "UK",
  displayName: "United Kingdom",
  countryName: "United Kingdom",
  locale: "en-GB",
  branding: {
    flag: "🇬🇧",
  },
  ui: {
    jurisdictionLabel: "UK jurisdiction",
    organizationLabel: "Organisation",
    showPhilippineStatutoryLibrary: false,
    capabilities: {
      // AI chat itself works, but its live grounding (chat-wonder-v2-api) isn't
      // jurisdiction-aware yet — see UK_PERSONA_PENDING in ilovelawyer-api's
      // legal/uk/legal-knowledge/uk-legal-knowledge.provider.ts.
      aiChat: "pending-persona",
      cases: "available",
      documents: "available",
      // No UK case-law/statute corpus yet — see ilovelawyer-api's
      // docs/uk-legal-corpus-contract.md.
      legalSearch: "coming-soon",
      // The citation-check UI only ever submits free-text quotedText/officialText — it never
      // exposes a legalRagId picker into the PH-only corpus, so it's already jurisdiction-neutral
      // and fully available. (The backend still rejects a legalRagId-based check against a
      // non-PH case as defense-in-depth, in case another client ever sends one.)
      citations: "available",
      // Real UK deadline engine exists (3 CPR rules) but is explicitly
      // LEGAL_REVIEW_REQUIRED and dual-attorney-confirmation gated on the backend —
      // shown, not hidden.
      deadlines: "available-provisional",
    },
  },
}
