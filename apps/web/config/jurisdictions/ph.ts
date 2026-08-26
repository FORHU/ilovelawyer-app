import type { JurisdictionConfig } from "./types"

export const phJurisdictionConfig: JurisdictionConfig = {
  code: "PH",
  displayName: "Philippines",
  countryName: "Philippines",
  locale: "en-PH",
  branding: {
    flag: "🇵🇭",
  },
  ui: {
    jurisdictionLabel: "Philippine jurisdiction",
    organizationLabel: "Organization",
    showPhilippineStatutoryLibrary: true,
    capabilities: {
      aiChat: "available",
      cases: "available",
      documents: "available",
      legalSearch: "available",
      citations: "available",
      deadlines: "available",
    },
  },
}
