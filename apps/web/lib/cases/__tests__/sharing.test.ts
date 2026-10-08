import { describe, expect, it } from "vitest"
import { accessOf, permissionFor } from "@/lib/cases/sharing"

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

  describe("on a confidential case (#346)", () => {
    it("only the org OWNER keeps access by role; an ADMIN without a grant is walled off", () => {
      expect(accessOf({ orgRole: "OWNER", grant: null }, true)).toEqual({ source: "org-admin", level: "manage", granted: false })
      expect(accessOf({ orgRole: "ADMIN", grant: null }, true)).toEqual({ source: "walled", level: "none", granted: false })
    })

    it("a member without a grant has no access; with one, the grant decides", () => {
      expect(accessOf({ orgRole: "MEMBER", grant: null }, true)).toEqual({ source: "walled", level: "none", granted: false })
      expect(accessOf({ orgRole: "MEMBER", grant: "VIEW" }, true)).toEqual({ source: "grant", level: "view", granted: true })
      expect(accessOf({ orgRole: "ADMIN", grant: "ADMIN" }, true)).toEqual({ source: "grant", level: "manage", granted: true })
    })
  })
})

describe("permissionFor — the grant behind a picked level", () => {
  it("edit and manage are always EDIT and ADMIN grants", () => {
    expect(permissionFor("edit", false)).toBe("EDIT")
    expect(permissionFor("manage", true)).toBe("ADMIN")
  })

  it("view is no grant on an ordinary case (everyone has it), but a VIEW grant on a confidential one", () => {
    expect(permissionFor("view", false)).toBe(null)
    expect(permissionFor("view", true)).toBe("VIEW")
  })

  it("no access is no grant", () => {
    expect(permissionFor("none", true)).toBe(null)
  })
})
