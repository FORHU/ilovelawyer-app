import type { TenantCodeConfig } from "./types"

/** South Korea: kr.ilovelawyer.com (dev: kr-dev.ilovelawyer.com, local:
 * http://kr-dev.ilovelawyer.local:3002). Being built in steps; every capability that needs Korean
 * legal content or a KR-aware API stays "coming-soon" until that part ships. */
export const krTenantCodeConfig: TenantCodeConfig = {
  code: "KR",
  displayName: "South Korea",
  countryName: "South Korea",
  // Korean date order on this site whatever the display language: 2026년 11월 12일.
  locale: "ko-KR",
  languages: ["ko", "en"],
  defaultLanguage: "ko",
  currency: "KRW",
  i18nContext: "KR",
  weekStartsOn: 0,
  // Agreed: KR gets the free trial. It's consultation-only, so it opens together with aiChat.
  trial: false,
  branding: {
    flag: "🇰🇷",
  },
  // TODO: temporary — swap for KR photography once sourced (same stopgap PH uses).
  landingAssets: {
    heroVideos: ["/landing/videos/hero-1.mp4", "/landing/videos/hero-2.mp4", "/landing/videos/hero-3.mp4"],
    heroPosters: ["/landing/uk/hero-1.jpg", "/landing/uk/hero-2.jpg", "/landing/uk/hero-3.jpg"],
    firmWorkspace: "/landing/uk/firm-workspace.jpg",
  },
  ui: {
    tenantCodeLabel: "Korean jurisdiction",
    organizationLabel: "Law firm",
    showPhilippineStatutoryLibrary: false,
    caseIntake: {
      caseTitleExample: "2026가합12345 손해배상(기)",
      jurisdictionExample: "서울중앙지방법원",
      // One legal system, so the sub-jurisdiction selector stays hidden.
      ukJurisdictionOptions: [],
    },
    capabilities: {
      // Chat Wonder's legal_kr persona (Korean Law MCP; chat-wonder-v2-api PR #141), which the API
      // picks with the [legal ai kr] tag. No Korean doctrine guards yet, and the analysis panes have
      // no KR prompts yet; this is chat and consultation only.
      aiChat: "available",
      cases: "available",
      documents: "available",
      // Needs a KR law source in the API (law.go.kr) and a KR library config here.
      legalSearch: "coming-soon",
      // Free-text check only, so it's tenant-neutral (same reasoning as UK).
      citations: "available",
      // Needs a KR deadline engine in the API.
      deadlines: "coming-soon",
      // Waits on Korean legal review of the referral model (Attorney-at-Law Act Art. 34).
      clientRequests: "coming-soon",
      // The KR registration: Korean Bar Association number and local bar, plus the optional
      // qualification route, specialties and registration date. Approval lets a new KR lawyer in
      // (verify before plan, as on UK).
      lawyerApplication: "available",
    },
  },
}
