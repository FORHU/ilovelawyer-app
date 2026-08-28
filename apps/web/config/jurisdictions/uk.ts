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
      // chat-wonder-v2-api routes UK requests to its own `legal_uk` persona (UK tool
      // whitelist + prompt) — see ilovelawyer-api's chatWonder.ts and
      // legal/uk/legal-knowledge/uk-legal-knowledge.provider.ts.
      aiChat: "available",
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
