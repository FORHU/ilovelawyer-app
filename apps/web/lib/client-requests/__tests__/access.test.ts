import { describe, it, expect } from "vitest"
import { clientRequestAccess, isClientError } from "../access"
import type { VerificationStatus } from "../profile"

const profile = (status: VerificationStatus) => ({ verification: { status, note: null, verifiedAt: null } })

describe("clientRequestAccess", () => {
  it("is ready for a verified UK lawyer", () => {
    expect(clientRequestAccess("UK", profile("VERIFIED"))).toBe("ready")
  })

  it("is not available on PH, whatever the verification", () => {
    expect(clientRequestAccess("PH", profile("VERIFIED"))).toBe("not-available")
    expect(clientRequestAccess("PH", undefined)).toBe("not-available")
  })

  it("is not available while the site is unknown", () => {
    expect(clientRequestAccess(null, profile("VERIFIED"))).toBe("not-available")
  })

  it("waits for the profile on UK", () => {
    expect(clientRequestAccess("UK", undefined)).toBeNull()
  })

  it("names why an unverified UK lawyer can't see requests", () => {
    expect(clientRequestAccess("UK", profile("UNSUBMITTED"))).toBe("incomplete")
    expect(clientRequestAccess("UK", profile("PENDING"))).toBe("pending")
    expect(clientRequestAccess("UK", profile("REJECTED"))).toBe("rejected")
  })
})

describe("isClientError", () => {
  it("is true for a 4xx answer", () => {
    expect(isClientError(Object.assign(new Error("Forbidden"), { status: 403 }))).toBe(true)
    expect(isClientError(Object.assign(new Error("Not found"), { status: 404 }))).toBe(true)
  })

  it("is false for a 5xx, a network failure, or nothing", () => {
    expect(isClientError(Object.assign(new Error("Server error"), { status: 500 }))).toBe(false)
    expect(isClientError(new TypeError("Failed to fetch"))).toBe(false)
    expect(isClientError(null)).toBe(false)
  })
})
