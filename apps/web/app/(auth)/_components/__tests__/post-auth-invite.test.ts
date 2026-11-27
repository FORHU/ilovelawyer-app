import { describe, it, expect } from "vitest"
import { resolvePostAuthDestination, resolveInviteBannerState } from "../post-auth-invite"

describe("resolvePostAuthDestination", () => {
  it("routes to the client request when the invite was redeemed", () => {
    const decision = resolvePostAuthDestination({ requestId: "req-1", caseId: "case-1" })
    expect(decision).toEqual({ kind: "redeemed", destination: "/homepage/client-requests/req-1" })
  })

  it("reports failure without a destination when redemption errored", () => {
    const decision = resolvePostAuthDestination({ error: "INVITE_EXPIRED" })
    expect(decision).toEqual({ kind: "failed" })
  })

  it("does nothing when no caseLawyerInvite was returned", () => {
    const decision = resolvePostAuthDestination(null)
    expect(decision).toEqual({ kind: "none" })
  })
})

describe("resolveInviteBannerState", () => {
  it("shows nothing when there is no token", () => {
    expect(resolveInviteBannerState({ hasToken: false, isLoading: false, lookup: undefined })).toEqual({ kind: "none" })
  })

  it("shows loading while the lookup is in flight", () => {
    expect(resolveInviteBannerState({ hasToken: true, isLoading: true, lookup: undefined })).toEqual({ kind: "loading" })
  })

  it("shows loading when data hasn't arrived yet even if isLoading is already false", () => {
    expect(resolveInviteBannerState({ hasToken: true, isLoading: false, lookup: undefined })).toEqual({ kind: "loading" })
  })

  it("shows the client's name and case when the invite is valid", () => {
    const lookup = { status: "valid" as const, clientFirstName: "Jamie", caseName: "Doe v. Roe", email: null }
    expect(resolveInviteBannerState({ hasToken: true, isLoading: false, lookup })).toEqual({
      kind: "valid",
      clientFirstName: "Jamie",
      caseName: "Doe v. Roe",
    })
  })

  it.each(["expired", "revoked", "accepted"] as const)("shows unavailable when the invite is %s", (status) => {
    const lookup = { status, clientFirstName: "Jamie", caseName: "Doe v. Roe", email: null }
    expect(resolveInviteBannerState({ hasToken: true, isLoading: false, lookup })).toEqual({ kind: "unavailable" })
  })
})
