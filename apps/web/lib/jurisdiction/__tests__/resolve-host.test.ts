import { describe, it, expect } from "vitest"
import { resolveJurisdictionFromHost, hostForJurisdiction } from "../resolve-host"

describe("resolveJurisdictionFromHost", () => {
  it("resolves the four production/local PH and UK hosts", () => {
    expect(resolveJurisdictionFromHost("ph.ilovelawyer.com")).toBe("PH")
    expect(resolveJurisdictionFromHost("ph.ilovelawyer.local")).toBe("PH")
    expect(resolveJurisdictionFromHost("uk.ilovelawyer.com")).toBe("UK")
    expect(resolveJurisdictionFromHost("uk.ilovelawyer.local")).toBe("UK")
  })

  it("strips a trailing port before matching", () => {
    expect(resolveJurisdictionFromHost("ph.ilovelawyer.local:3002")).toBe("PH")
    expect(resolveJurisdictionFromHost("uk.ilovelawyer.local:3002")).toBe("UK")
  })

  it("also resolves the bare ph.ilovelawyer/uk.ilovelawyer dev convention (no .local)", () => {
    expect(resolveJurisdictionFromHost("ph.ilovelawyer:3002")).toBe("PH")
    expect(resolveJurisdictionFromHost("uk.ilovelawyer:3002")).toBe("UK")
    expect(resolveJurisdictionFromHost("ph.ilovelawyer")).toBe("PH")
    expect(resolveJurisdictionFromHost("uk.ilovelawyer")).toBe("UK")
  })

  it("returns null for an unrecognized host, never guessing", () => {
    expect(resolveJurisdictionFromHost("ilovelawyer.com")).toBeNull()
    expect(resolveJurisdictionFromHost("localhost:3002")).toBeNull()
    expect(resolveJurisdictionFromHost("sg.ilovelawyer.com")).toBeNull()
    expect(resolveJurisdictionFromHost(undefined)).toBeNull()
    expect(resolveJurisdictionFromHost(null)).toBeNull()
    expect(resolveJurisdictionFromHost("")).toBeNull()
  })

  it("does not use substring matching", () => {
    expect(resolveJurisdictionFromHost("notph.ilovelawyer.com")).toBeNull()
  })
})

describe("hostForJurisdiction", () => {
  it("targets the production domain when the current host is not a .local one", () => {
    expect(hostForJurisdiction("PH", "uk.ilovelawyer.com")).toBe("ph.ilovelawyer.com")
    expect(hostForJurisdiction("UK", "ph.ilovelawyer.com")).toBe("uk.ilovelawyer.com")
  })

  it("targets the local dev domain (with port) when the current host is .local", () => {
    expect(hostForJurisdiction("UK", "ph.ilovelawyer.local:3002")).toBe("uk.ilovelawyer.local:3002")
    expect(hostForJurisdiction("PH", "uk.ilovelawyer.local:3002")).toBe("ph.ilovelawyer.local:3002")
  })

  it("preserves the bare ph.ilovelawyer/uk.ilovelawyer dev convention (no .local)", () => {
    expect(hostForJurisdiction("UK", "ph.ilovelawyer:3002")).toBe("uk.ilovelawyer:3002")
    expect(hostForJurisdiction("PH", "uk.ilovelawyer:3002")).toBe("ph.ilovelawyer:3002")
  })
})
