import { describe, it, expect } from "vitest"
import { resolveTenantCodeFromHost, hostForTenantCode, isTenantCode, TENANT_CODES } from "../resolve-host"

describe("resolveTenantCodeFromHost", () => {
  it("resolves the four production/local PH and UK hosts", () => {
    expect(resolveTenantCodeFromHost("ph.ilovelawyer.com")).toBe("PH")
    expect(resolveTenantCodeFromHost("ph.ilovelawyer.local")).toBe("PH")
    expect(resolveTenantCodeFromHost("uk.ilovelawyer.com")).toBe("UK")
    expect(resolveTenantCodeFromHost("uk.ilovelawyer.local")).toBe("UK")
  })

  it("strips a trailing port before matching", () => {
    expect(resolveTenantCodeFromHost("ph.ilovelawyer.local:3002")).toBe("PH")
    expect(resolveTenantCodeFromHost("uk.ilovelawyer.local:3002")).toBe("UK")
  })

  it("also resolves the bare ph.ilovelawyer/uk.ilovelawyer dev convention (no .local)", () => {
    expect(resolveTenantCodeFromHost("ph.ilovelawyer:3002")).toBe("PH")
    expect(resolveTenantCodeFromHost("uk.ilovelawyer:3002")).toBe("UK")
    expect(resolveTenantCodeFromHost("ph.ilovelawyer")).toBe("PH")
    expect(resolveTenantCodeFromHost("uk.ilovelawyer")).toBe("UK")
  })

  it("resolves the hosted -dev.ilovelawyer.com environment", () => {
    expect(resolveTenantCodeFromHost("ph-dev.ilovelawyer.com")).toBe("PH")
    expect(resolveTenantCodeFromHost("uk-dev.ilovelawyer.com")).toBe("UK")
  })

  it("resolves the https -local.ilovelawyer.com local-dev hosts (for Google sign-in)", () => {
    expect(resolveTenantCodeFromHost("ph-local.ilovelawyer.com:3002")).toBe("PH")
    expect(resolveTenantCodeFromHost("uk-local.ilovelawyer.com:3002")).toBe("UK")
  })

  it("resolves the -dev.ilovelawyer.local local-dev counterpart", () => {
    expect(resolveTenantCodeFromHost("ph-dev.ilovelawyer.local:3002")).toBe("PH")
    expect(resolveTenantCodeFromHost("uk-dev.ilovelawyer.local:3002")).toBe("UK")
  })

  it("returns null for an unrecognized host, never guessing", () => {
    expect(resolveTenantCodeFromHost("ilovelawyer.com")).toBeNull()
    expect(resolveTenantCodeFromHost("localhost:3002")).toBeNull()
    expect(resolveTenantCodeFromHost("sg.ilovelawyer.com")).toBeNull()
    expect(resolveTenantCodeFromHost(undefined)).toBeNull()
    expect(resolveTenantCodeFromHost(null)).toBeNull()
    expect(resolveTenantCodeFromHost("")).toBeNull()
  })

  it("does not use substring matching", () => {
    expect(resolveTenantCodeFromHost("notph.ilovelawyer.com")).toBeNull()
  })

  it("resolves the three KR hosts: prod, hosted dev and local", () => {
    expect(resolveTenantCodeFromHost("kr.ilovelawyer.com")).toBe("KR")
    expect(resolveTenantCodeFromHost("kr-dev.ilovelawyer.com")).toBe("KR")
    expect(resolveTenantCodeFromHost("kr-dev.ilovelawyer.local:3002")).toBe("KR")
  })

  it("resolves the other KR dev forms PH and UK also have", () => {
    expect(resolveTenantCodeFromHost("kr.ilovelawyer.local:3002")).toBe("KR")
    expect(resolveTenantCodeFromHost("kr-local.ilovelawyer.com:3002")).toBe("KR")
    expect(resolveTenantCodeFromHost("kr.ilovelawyer:3002")).toBe("KR")
    expect(resolveTenantCodeFromHost("kr.localhost:3002")).toBe("KR")
  })
})

describe("isTenantCode", () => {
  it("accepts every known code and nothing else", () => {
    for (const code of TENANT_CODES) expect(isTenantCode(code)).toBe(true)
    expect(isTenantCode("kr")).toBe(false)
    expect(isTenantCode("SG")).toBe(false)
    expect(isTenantCode("")).toBe(false)
    expect(isTenantCode(null)).toBe(false)
  })
})

describe("hostForTenantCode", () => {
  it("targets the production domain when the current host is not a .local one", () => {
    expect(hostForTenantCode("PH", "uk.ilovelawyer.com")).toBe("ph.ilovelawyer.com")
    expect(hostForTenantCode("UK", "ph.ilovelawyer.com")).toBe("uk.ilovelawyer.com")
  })

  it("targets the local dev domain (with port) when the current host is .local", () => {
    expect(hostForTenantCode("UK", "ph.ilovelawyer.local:3002")).toBe("uk.ilovelawyer.local:3002")
    expect(hostForTenantCode("PH", "uk.ilovelawyer.local:3002")).toBe("ph.ilovelawyer.local:3002")
  })

  it("preserves the bare ph.ilovelawyer/uk.ilovelawyer dev convention (no .local)", () => {
    expect(hostForTenantCode("UK", "ph.ilovelawyer:3002")).toBe("uk.ilovelawyer:3002")
    expect(hostForTenantCode("PH", "uk.ilovelawyer:3002")).toBe("ph.ilovelawyer:3002")
  })

  it("preserves the -dev suffix on the hosted dev environment", () => {
    expect(hostForTenantCode("UK", "ph-dev.ilovelawyer.com")).toBe("uk-dev.ilovelawyer.com")
    expect(hostForTenantCode("PH", "uk-dev.ilovelawyer.com")).toBe("ph-dev.ilovelawyer.com")
  })

  it("preserves the -local suffix on the https local-dev hosts (with port)", () => {
    expect(hostForTenantCode("UK", "ph-local.ilovelawyer.com:3002")).toBe("uk-local.ilovelawyer.com:3002")
    expect(hostForTenantCode("PH", "uk-local.ilovelawyer.com:3002")).toBe("ph-local.ilovelawyer.com:3002")
  })

  it("preserves the -dev suffix on the .local counterpart (with port)", () => {
    expect(hostForTenantCode("UK", "ph-dev.ilovelawyer.local:3002")).toBe("uk-dev.ilovelawyer.local:3002")
    expect(hostForTenantCode("PH", "uk-dev.ilovelawyer.local:3002")).toBe("ph-dev.ilovelawyer.local:3002")
  })

  it("moves to and from the KR hosts in every convention", () => {
    expect(hostForTenantCode("KR", "uk.ilovelawyer.com")).toBe("kr.ilovelawyer.com")
    expect(hostForTenantCode("KR", "ph-dev.ilovelawyer.com")).toBe("kr-dev.ilovelawyer.com")
    expect(hostForTenantCode("KR", "uk-dev.ilovelawyer.local:3002")).toBe("kr-dev.ilovelawyer.local:3002")
    expect(hostForTenantCode("UK", "kr.ilovelawyer.com")).toBe("uk.ilovelawyer.com")
    expect(hostForTenantCode("PH", "kr-dev.ilovelawyer.local:3002")).toBe("ph-dev.ilovelawyer.local:3002")
    expect(hostForTenantCode("UK", "kr-local.ilovelawyer.com:3002")).toBe("uk-local.ilovelawyer.com:3002")
  })
})
