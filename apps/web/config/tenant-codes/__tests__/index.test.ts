import { describe, it, expect } from "vitest"
import { getTenantCodeConfig } from "../index"

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

  it("defaults to PH presentation when the tenant code is unresolved (display default only)", () => {
    expect(getTenantCodeConfig(null).code).toBe("PH")
    expect(getTenantCodeConfig(undefined).code).toBe("PH")
  })

  it("PH and UK configs use distinct flags", () => {
    expect(getTenantCodeConfig("PH").branding.flag).not.toBe(getTenantCodeConfig("UK").branding.flag)
  })
})
