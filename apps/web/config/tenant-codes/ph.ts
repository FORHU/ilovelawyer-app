import type { TenantCodeConfig } from "./types"

export const phTenantCodeConfig: TenantCodeConfig = {
  code: "PH",
  displayName: "Philippines",
  countryName: "Philippines",
  locale: "en-PH",
  branding: {
    flag: "🇵🇭",
  },
  ui: {
    tenantCodeLabel: "Philippine jurisdiction",
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
