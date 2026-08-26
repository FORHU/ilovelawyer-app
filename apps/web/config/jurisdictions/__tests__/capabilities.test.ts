import { describe, it, expect } from "vitest"
import { getJurisdictionCapabilities, isFeatureEnabled, getStatus } from "../capabilities"

describe("getJurisdictionCapabilities / isFeatureEnabled", () => {
  it("PH has every capability available", () => {
    const caps = getJurisdictionCapabilities("PH")
    expect(caps.aiChat).toBe("available")
    expect(caps.cases).toBe("available")
    expect(caps.documents).toBe("available")
    expect(caps.legalSearch).toBe("available")
    expect(caps.citations).toBe("available")
    expect(caps.deadlines).toBe("available")

    for (const feature of Object.keys(caps) as (keyof typeof caps)[]) {
      expect(isFeatureEnabled("PH", feature)).toBe(true)
    }
  })

  it("UK gates legalSearch as coming-soon (no ingested UK corpus yet)", () => {
    expect(getStatus("UK", "legalSearch")).toBe("coming-soon")
    expect(isFeatureEnabled("UK", "legalSearch")).toBe(false)
  })

  it("UK citation checking is available (jurisdiction-neutral free-text verification)", () => {
    expect(getStatus("UK", "citations")).toBe("available")
    expect(isFeatureEnabled("UK", "citations")).toBe(true)
  })

  it("UK treats provisional deadlines and pending-persona chat as enabled, not gated", () => {
    expect(getStatus("UK", "deadlines")).toBe("available-provisional")
    expect(getStatus("UK", "aiChat")).toBe("pending-persona")
    expect(isFeatureEnabled("UK", "deadlines")).toBe(true)
    expect(isFeatureEnabled("UK", "aiChat")).toBe(true)
  })

  it("UK cases and documents are fully available (jurisdiction-neutral features)", () => {
    expect(getStatus("UK", "cases")).toBe("available")
    expect(getStatus("UK", "documents")).toBe("available")
  })

  it("defaults to PH capabilities when jurisdiction is unresolved", () => {
    expect(isFeatureEnabled(null, "legalSearch")).toBe(true)
    expect(isFeatureEnabled(undefined, "legalSearch")).toBe(true)
  })
})
