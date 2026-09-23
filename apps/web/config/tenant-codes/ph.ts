import type { TenantCodeConfig } from "./types"

export const phTenantCodeConfig: TenantCodeConfig = {
  code: "PH",
  displayName: "Philippines",
  countryName: "Philippines",
  locale: "en-PH",
  branding: {
    flag: "🇵🇭",
  },
  // TODO: temporary — swap for real PH photography once sourced. Points at UK's asset
  // paths so nothing is visually broken; each line below is a one-line path swap once
  // real PH photos land, no component changes required.
  landingAssets: {
    heroVideos: ["/landing/videos/hero-1.mp4", "/landing/videos/hero-2.mp4", "/landing/videos/hero-3.mp4"],
    heroPosters: ["/landing/uk/hero-1.jpg", "/landing/uk/hero-2.jpg", "/landing/uk/hero-3.jpg"],
    firmWorkspace: "/landing/uk/firm-workspace.jpg",
  },
  ui: {
    tenantCodeLabel: "Philippine jurisdiction",
    organizationLabel: "Organization",
    showPhilippineStatutoryLibrary: true,
    caseIntake: {
      caseTitleExample: "Cruz vs. Santos",
      jurisdictionExample: "RTC Branch 12, Makati City",
      ukJurisdictionOptions: [],
    },
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
