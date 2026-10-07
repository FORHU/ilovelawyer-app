import { describe, expect, it } from "vitest"
import { isNewAccount } from "@/lib/onboarding/new-account"

describe("isNewAccount", () => {
  it("is new with no cases, active or archived, and no consultations", () => {
    expect(isNewAccount(0, 0, 0)).toBe(true)
  })

  it("isn't new once there's a case, an archived case or a consultation", () => {
    expect(isNewAccount(1, 0, 0)).toBe(false)
    expect(isNewAccount(0, 2, 0)).toBe(false)
    expect(isNewAccount(0, 0, 1)).toBe(false)
  })

  it("isn't new while anything is still loading, so existing users never see it flash", () => {
    expect(isNewAccount(undefined, 0, 0)).toBe(false)
    expect(isNewAccount(0, undefined, 0)).toBe(false)
    expect(isNewAccount(0, 0, undefined)).toBe(false)
  })
})
