import { describe, it, expect } from "vitest"
import { getTenantCodeConfig, tenantI18nContext } from "../index"
import { TENANT_CODES } from "@/lib/tenant-code/resolve-host"

describe("getTenantCodeConfig", () => {
  it("returns correct PH presentation config", () => {
    const config = getTenantCodeConfig("PH")
    expect(config.code).toBe("PH")
    expect(config.displayName).toBe("Philippines")
    expect(config.locale).toBe("en-PH")
    expect(config.ui.organizationLabel).toBe("Organization")
    expect(config.ui.showPhilippineStatutoryLibrary).toBe(true)
  })

  it("returns correct UK presentation config, independently terminologically", () => {
    const config = getTenantCodeConfig("UK")
    expect(config.code).toBe("UK")
    expect(config.displayName).toBe("United Kingdom")
    expect(config.locale).toBe("en-GB")
    expect(config.ui.organizationLabel).toBe("Organisation")
    expect(config.ui.showPhilippineStatutoryLibrary).toBe(false)
  })

  it("returns the KR presentation config: Korean first, KRW, Korean date order", () => {
    const config = getTenantCodeConfig("KR")
    expect(config.code).toBe("KR")
    expect(config.locale).toBe("ko-KR")
    expect(config.languages).toEqual(["ko", "en"])
    expect(config.defaultLanguage).toBe("ko")
    expect(config.currency).toBe("KRW")
    expect(config.ui.showPhilippineStatutoryLibrary).toBe(false)
    expect(config.ui.caseIntake.ukJurisdictionOptions).toEqual([])
  })

  it("every tenant's default language is one it offers", () => {
    for (const code of TENANT_CODES) {
      const config = getTenantCodeConfig(code)
      expect(config.code).toBe(code)
      expect(config.languages).toContain(config.defaultLanguage)
    }
  })

  it("Korean dates on the KR site read 2026년 11월 12일", () => {
    const date = new Date(Date.UTC(2026, 10, 12))
    const opts = { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" } as const
    expect(date.toLocaleDateString(getTenantCodeConfig("KR").locale, opts)).toBe("2026년 11월 12일")
  })

  it("picks the i18n context per site: UK and KR variants, plain keys on PH", () => {
    expect(tenantI18nContext("UK")).toEqual({ context: "UK" })
    expect(tenantI18nContext("KR")).toEqual({ context: "KR" })
    expect(tenantI18nContext("PH")).toBeUndefined()
    expect(tenantI18nContext(null)).toBeUndefined()
  })

  it("defaults to PH presentation when the tenant code is unresolved (display default only)", () => {
    expect(getTenantCodeConfig(null).code).toBe("PH")
    expect(getTenantCodeConfig(undefined).code).toBe("PH")
  })

  it("PH and UK configs use distinct flags", () => {
    expect(getTenantCodeConfig("PH").branding.flag).not.toBe(getTenantCodeConfig("UK").branding.flag)
  })

  it("PH and UK landing assets resolve to valid /landing paths", () => {
    const ph = getTenantCodeConfig("PH")
    const uk = getTenantCodeConfig("UK")
    expect(uk.landingAssets.heroVideos.every((p) => p.startsWith("/landing/videos/"))).toBe(true)
    // PH temporarily reuses UK's photography until real PH photos are sourced (see ph.ts TODO).
    expect(ph.landingAssets.firmWorkspace).toBe(uk.landingAssets.firmWorkspace)
  })
})
