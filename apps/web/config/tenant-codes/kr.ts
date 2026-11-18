import type { TenantCodeConfig } from "./types"

export const krTenantCodeConfig: TenantCodeConfig = {
  code: "KR",
  displayName: "South Korea",
  countryName: "South Korea",
  locale: "ko-KR",
  languages: ["ko", "en"],
  defaultLanguage: "ko",
  branding: {
    flag: "🇰🇷",
  },
  // The KR hero is three still images (no videos). firmWorkspace still borrows UK's photo; it
  // only shows in the testimonial section, which is switched off.
  landingAssets: {
    heroPosters: ["/landing/kr/hero-1.jpg", "/landing/kr/hero-2.jpg", "/landing/kr/hero-3.jpg"],
    firmWorkspace: "/landing/uk/firm-workspace.jpg",
  },
  ui: {
    tenantCodeLabel: "Korean jurisdiction",
    organizationLabel: "Organization",
    showPhilippineStatutoryLibrary: false,
    caseIntake: {
      caseTitleExample: "Kim v. Lee",
      jurisdictionExample: "Seoul Central District Court",
      ukJurisdictionOptions: [],
    },
    // Every feature is gated until the backend has a KR persona, deadline engine and library source
    // behind it (ilovelawyer-api's registries); flip each one as its backend support lands.
    capabilities: {
      aiChat: "coming-soon",
      cases: "coming-soon",
      documents: "coming-soon",
      legalSearch: "coming-soon",
      citations: "coming-soon",
      deadlines: "coming-soon",
      clientRequests: "coming-soon",
      lawyerApplication: "coming-soon",
    },
  },
}
