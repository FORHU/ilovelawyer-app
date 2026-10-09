import { describe, expect, it } from "vitest"
import { canEditCases } from "@/lib/cases/permissions"
import type { OrganizationRole } from "@/lib/organizations/queries"

const org = (role: OrganizationRole, isPersonal = false) => ({ role, isPersonal })

describe("canEditCases — mirrors the API's CaseAccess.assertCanEdit", () => {
  it("lets an organization OWNER or ADMIN edit", () => {
    expect(canEditCases({ workspace: "organization", organization: org("OWNER") })).toBe(true)
    expect(canEditCases({ workspace: "organization", organization: org("ADMIN") })).toBe(true)
  })

  it("refuses a MANAGER or MEMBER of an organization", () => {
    expect(canEditCases({ workspace: "organization", organization: org("MANAGER") })).toBe(false)
    expect(canEditCases({ workspace: "organization", organization: org("MEMBER") })).toBe(false)
  })

  it("lets anyone edit in their portfolio, whatever their role in the organization", () => {
    expect(canEditCases({ workspace: "portfolio", organization: org("MEMBER") })).toBe(true)
  })

  it("lets a solo user edit in their personal workspace", () => {
    expect(canEditCases({ workspace: "organization", organization: org("OWNER", true) })).toBe(true)
  })

  it("refuses in someone else's portfolio, opened through a read-only share", () => {
    expect(canEditCases({ workspace: "shared", organization: org("OWNER") })).toBe(false)
    expect(canEditCases({ workspace: "shared", organization: org("OWNER", true) })).toBe(false)
  })

  it("refuses while no organization is loaded yet", () => {
    expect(canEditCases({ workspace: "organization", organization: null })).toBe(false)
  })
})
