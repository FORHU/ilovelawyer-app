import { describe, it, expect } from "vitest"
import { formFromProfile, patchFromForm, toggle, validateForm, type ProfileForm } from "../profile-form"
import type { ClientRequestProfile } from "../profile"

const profile: ClientRequestProfile = {
  regulator: "SRA",
  registrationNumber: "123456",
  qualifiedJurisdictions: ["England and Wales"],
  practiceAreas: ["EMPLOYMENT"],
  bio: "Employment specialist.",
  languages: ["English", "Welsh"],
  firstConsultationFee: { amountMinor: 14950, currency: "GBP" },
  acceptingRequests: true,
  enabledByOrganization: true,
  pausedUntil: "2026-11-01T00:00:00.000Z",
  capacityLimit: 3,
  openEngagements: 0,
  verification: { status: "VERIFIED", note: null, verifiedAt: "2026-10-01T00:00:00.000Z" },
  missing: [],
}

const blank: ProfileForm = {
  regulator: null,
  registrationNumber: "",
  qualifiedJurisdictions: [],
  practiceAreas: [],
  bio: "",
  languages: "",
  fee: "",
  pausedUntil: "",
  capacityLimit: "",
}

describe("client request profile form", () => {
  it("round-trips a saved profile through the form", () => {
    const form = formFromProfile(profile)
    expect(form).toMatchObject({ fee: "149.5", languages: "English, Welsh", pausedUntil: "2026-11-01", capacityLimit: "3" })
    expect(patchFromForm(form)).toEqual({
      regulator: "SRA",
      registrationNumber: "123456",
      qualifiedJurisdictions: ["England and Wales"],
      practiceAreas: ["EMPLOYMENT"],
      bio: "Employment specialist.",
      languages: ["English", "Welsh"],
      firstConsultationFee: { amountMinor: 14950, currency: "GBP" },
      pausedUntil: "2026-11-01T00:00:00.000Z",
      capacityLimit: 3,
    })
  })

  it("sends empty fields as cleared, and never the accepting switch", () => {
    const patch = patchFromForm(blank)
    expect(patch).toMatchObject({ registrationNumber: null, firstConsultationFee: null, pausedUntil: null, capacityLimit: null, languages: [] })
    expect(patch).not.toHaveProperty("acceptingRequests")
  })

  it("takes a fee with a pound sign and de-duplicates languages", () => {
    expect(patchFromForm({ ...blank, fee: "£150", languages: "English, english , English" }).firstConsultationFee).toEqual({ amountMinor: 15000, currency: "GBP" })
    expect(patchFromForm({ ...blank, languages: "English, Welsh, English" }).languages).toEqual(["English", "Welsh"])
  })

  it("explains what's wrong with each field the API would refuse", () => {
    expect(validateForm(blank)).toEqual({})
    expect(Object.keys(validateForm({ ...blank, fee: "abc" }))).toEqual(["fee"])
    expect(Object.keys(validateForm({ ...blank, fee: "1.234" }))).toEqual(["fee"])
    expect(validateForm({ ...blank, fee: "0.29" })).toEqual({})
    expect(patchFromForm({ ...blank, fee: "0.29" }).firstConsultationFee).toEqual({ amountMinor: 29, currency: "GBP" })
    expect(Object.keys(validateForm({ ...blank, capacityLimit: "0" }))).toEqual(["capacityLimit"])
    expect(Object.keys(validateForm({ ...blank, capacityLimit: "2.5" }))).toEqual(["capacityLimit"])
    expect(Object.keys(validateForm({ ...blank, registrationNumber: "x".repeat(41) }))).toEqual(["registrationNumber"])
    expect(Object.keys(validateForm({ ...blank, bio: "x".repeat(1501) }))).toEqual(["bio"])
  })

  it("toggles a value in a list", () => {
    expect(toggle(["A"], "B")).toEqual(["A", "B"])
    expect(toggle(["A", "B"], "A")).toEqual(["B"])
  })
})
