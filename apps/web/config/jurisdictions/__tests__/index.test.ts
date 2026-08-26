import { describe, it, expect } from "vitest"
import { getJurisdictionConfig } from "../index"

describe("getJurisdictionConfig", () => {
  it("returns correct PH presentation config", () => {
    const config = getJurisdictionConfig("PH")
    expect(config.code).toBe("PH")
    expect(config.displayName).toBe("Philippines")
    expect(config.locale).toBe("en-PH")
    expect(config.ui.organizationLabel).toBe("Organization")
    expect(config.ui.showPhilippineStatutoryLibrary).toBe(true)
  })

  it("returns correct UK presentation config, independently terminologically", () => {
    const config = getJurisdictionConfig("UK")
    expect(config.code).toBe("UK")
    expect(config.displayName).toBe("United Kingdom")
    expect(config.locale).toBe("en-GB")
    expect(config.ui.organizationLabel).toBe("Organisation")
    expect(config.ui.showPhilippineStatutoryLibrary).toBe(false)
  })

  it("defaults to PH presentation when jurisdiction is unresolved (display default only)", () => {
    expect(getJurisdictionConfig(null).code).toBe("PH")
    expect(getJurisdictionConfig(undefined).code).toBe("PH")
  })

  it("PH and UK configs use distinct flags", () => {
    expect(getJurisdictionConfig("PH").branding.flag).not.toBe(getJurisdictionConfig("UK").branding.flag)
  })
})
