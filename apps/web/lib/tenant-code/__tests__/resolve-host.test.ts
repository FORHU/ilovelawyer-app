import { describe, it, expect } from "vitest"
import { resolveTenantCodeFromHost, hostForTenantCode } from "../resolve-host"

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

  it("preserves the -dev suffix on the .local counterpart (with port)", () => {
    expect(hostForTenantCode("UK", "ph-dev.ilovelawyer.local:3002")).toBe("uk-dev.ilovelawyer.local:3002")
    expect(hostForTenantCode("PH", "uk-dev.ilovelawyer.local:3002")).toBe("ph-dev.ilovelawyer.local:3002")
  })
})
