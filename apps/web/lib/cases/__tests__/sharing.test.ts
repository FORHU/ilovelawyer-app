import { describe, expect, it } from "vitest"
import { accessOf } from "@/lib/cases/sharing"

describe("accessOf — what the sharing panel shows per person", () => {
  it("org OWNER/ADMIN: full access through their role, nothing granted to take back", () => {
    expect(accessOf({ orgRole: "OWNER", grant: null })).toEqual({ source: "org-admin", level: "manage", granted: false })
    // A grant on top of an admin role changes nothing — the role already covers it.
    expect(accessOf({ orgRole: "ADMIN", grant: "EDIT" })).toEqual({ source: "org-admin", level: "manage", granted: false })
  })

  it("a member with no grant can view, through the organization", () => {
    expect(accessOf({ orgRole: "MEMBER", grant: null })).toEqual({ source: "organization", level: "view", granted: false })
    expect(accessOf({ orgRole: "MANAGER", grant: null })).toEqual({ source: "organization", level: "view", granted: false })
  })

  it("a member's grant sets their level, and is marked as granted", () => {
    expect(accessOf({ orgRole: "MEMBER", grant: "EDIT" })).toEqual({ source: "grant", level: "edit", granted: true })
    expect(accessOf({ orgRole: "MEMBER", grant: "ADMIN" })).toEqual({ source: "grant", level: "manage", granted: true })
    expect(accessOf({ orgRole: "MEMBER", grant: "VIEW" })).toEqual({ source: "grant", level: "view", granted: true })
  })

  it("someone outside the organization holding a grant", () => {
    expect(accessOf({ orgRole: null, grant: "EDIT" })).toEqual({ source: "grant", level: "edit", granted: true })
  })
})
