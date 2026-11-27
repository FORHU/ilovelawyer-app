import { describe, it, expect } from "vitest"
import { resolvePostAuthDestination, resolveInviteBannerState, resolveRedeemableInviteToken } from "../post-auth-invite"

describe("resolvePostAuthDestination", () => {
  // No field on this response tells the frontend whether the lawyer's registration is VERIFIED
  // (LawyerProfile.verificationStatus, ClientRequestLawyerSvc.assertVerifiedLawyer on the API) — a
  // brand-new invited lawyer almost always isn't yet, and that route 403s for them. So redemption
  // never earns a destination of its own any more: the caller's normal post-auth flow decides
  // where to go, same as if there'd been no invite token at all.
  it("reports redeemed without a destination, so the caller's normal flow decides where to go", () => {
    const decision = resolvePostAuthDestination({ requestId: "req-1", caseId: "case-1" })
    expect(decision).toEqual({ kind: "redeemed" })
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
    expect(resolveInviteBannerState({ hasToken: false, isLoading: false, isError: false, lookup: undefined })).toEqual({ kind: "none" })
  })

  it("shows loading while the lookup is in flight", () => {
    expect(resolveInviteBannerState({ hasToken: true, isLoading: true, isError: false, lookup: undefined })).toEqual({ kind: "loading" })
  })

  it("shows loading when data hasn't arrived yet even if isLoading is already false", () => {
    expect(resolveInviteBannerState({ hasToken: true, isLoading: false, isError: false, lookup: undefined })).toEqual({ kind: "loading" })
  })

  it("shows the client's name and case when the invite is valid", () => {
    const lookup = { status: "valid" as const, clientFirstName: "Jamie", caseName: "Doe v. Roe", email: null }
    expect(resolveInviteBannerState({ hasToken: true, isLoading: false, isError: false, lookup })).toEqual({
      kind: "valid",
      clientFirstName: "Jamie",
      caseName: "Doe v. Roe",
    })
  })

  it.each(["expired", "revoked", "accepted"] as const)("shows unavailable when the invite is %s", (status) => {
    const lookup = { status, clientFirstName: "Jamie", caseName: "Doe v. Roe", email: null }
    expect(resolveInviteBannerState({ hasToken: true, isLoading: false, isError: false, lookup })).toEqual({ kind: "unavailable" })
  })

  it("shows unavailable (not loading forever) when the lookup errored, e.g. a malformed token's 404", () => {
    expect(resolveInviteBannerState({ hasToken: true, isLoading: false, isError: true, lookup: undefined })).toEqual({
      kind: "unavailable",
    })
  })
})

describe("resolveRedeemableInviteToken", () => {
  const lookup = { status: "valid" as const, clientFirstName: "Jamie", caseName: "Doe v. Roe", email: null }

  it("sends nothing when there is no token", () => {
    expect(resolveRedeemableInviteToken({ token: undefined, isError: false, lookup: undefined })).toBeUndefined()
  })

  it("drops the token while the lookup hasn't answered yet", () => {
    expect(resolveRedeemableInviteToken({ token: "tok", isError: false, lookup: undefined })).toBeUndefined()
  })

  it("drops a token the lookup rejected, so a malformed value can never block sign-in", () => {
    expect(resolveRedeemableInviteToken({ token: "garbage%20tok", isError: true, lookup: undefined })).toBeUndefined()
  })

  it("sends a token the lookup resolved as valid", () => {
    expect(resolveRedeemableInviteToken({ token: "tok", isError: false, lookup })).toBe("tok")
  })

  it.each(["expired", "revoked", "accepted"] as const)("still sends a resolved %s token and lets the server decide", (status) => {
    expect(resolveRedeemableInviteToken({ token: "tok", isError: false, lookup: { ...lookup, status } })).toBe("tok")
  })
})
