import { describe, it, expect } from "vitest"
import {
  applicationPatchFromForm,
  availabilityPatchFromForm,
  formFromProfile,
  missingFromForm,
  needsRecheck,
  patchFromForm,
  toggle,
  validateForm,
  type ProfileForm,
} from "../profile-form"
import type { ClientRequestProfile } from "../profile"

const profile: ClientRequestProfile = {
  country: "UK",
  registration: { country: "UK", regulator: "SRA", registrationNumber: "123456", qualifiedJurisdictions: ["England and Wales"] },
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

const phProfile: ClientRequestProfile = {
  ...profile,
  country: "PH",
  registration: { country: "PH", rollNumber: "12345", ibpChapter: "Manila III", ibpMembershipNumber: null, mcleNumber: "VII-0001", mclePeriod: "VII" },
  practiceAreas: ["LABOR"],
  firstConsultationFee: { amountMinor: 150000, currency: "PHP" },
}

const blank: ProfileForm = {
  country: "UK",
  regulator: null,
  registrationNumber: "",
  qualifiedJurisdictions: [],
  rollNumber: "",
  ibpChapter: "",
  ibpMembershipNumber: "",
  mcleNumber: "",
  mclePeriod: "",
  practiceAreas: [],
  bio: "",
  languages: [],
  fee: "",
  pausedUntil: "",
  capacityLimit: "",
}

describe("Lawyer Application form", () => {
  it("round-trips a saved UK profile through the form", () => {
    const form = formFromProfile(profile)
    expect(form).toMatchObject({ fee: "149.5", languages: ["English", "Welsh"], pausedUntil: "2026-11-01", capacityLimit: "3" })
    expect(patchFromForm(form)).toEqual({
      registration: { country: "UK", regulator: "SRA", registrationNumber: "123456", qualifiedJurisdictions: ["England and Wales"] },
      practiceAreas: ["EMPLOYMENT"],
      bio: "Employment specialist.",
      languages: ["English", "Welsh"],
      firstConsultationFee: { amountMinor: 14950, currency: "GBP" },
      pausedUntil: "2026-11-01T00:00:00.000Z",
      capacityLimit: 3,
    })
  })

  it("round-trips a PH profile, sending only PH registration fields, in pesos", () => {
    const patch = applicationPatchFromForm(formFromProfile(phProfile))
    expect(patch.registration).toEqual({ country: "PH", rollNumber: "12345", ibpChapter: "Manila III", ibpMembershipNumber: null, mcleNumber: "VII-0001", mclePeriod: "VII" })
    expect(patch.firstConsultationFee).toEqual({ amountMinor: 150000, currency: "PHP" })
  })

  it("sends empty fields as cleared, and never the accepting switch", () => {
    const patch = patchFromForm(blank)
    expect(patch).toMatchObject({ firstConsultationFee: null, pausedUntil: null, capacityLimit: null, languages: [] })
    expect(patch.registration).toEqual({ country: "UK", regulator: null, registrationNumber: null, qualifiedJurisdictions: [] })
    expect(patch).not.toHaveProperty("acceptingRequests")
  })

  it("takes a fee with a pound or peso sign", () => {
    expect(patchFromForm({ ...blank, fee: "£150" }).firstConsultationFee).toEqual({ amountMinor: 15000, currency: "GBP" })
    expect(patchFromForm({ ...blank, country: "PH", fee: "₱1,500".replace(",", "") }).firstConsultationFee).toEqual({ amountMinor: 150000, currency: "PHP" })
  })

  it("splits the save between the application and the availability settings", () => {
    const form = formFromProfile(profile)
    expect(Object.keys(applicationPatchFromForm(form)).sort()).toEqual(["bio", "firstConsultationFee", "languages", "practiceAreas", "registration"])
    expect(availabilityPatchFromForm(form)).toEqual({ pausedUntil: "2026-11-01T00:00:00.000Z", capacityLimit: 3 })
    expect(patchFromForm(form)).toEqual({ ...applicationPatchFromForm(form), ...availabilityPatchFromForm(form) })
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
    expect(Object.keys(validateForm({ ...blank, country: "PH", ibpChapter: "x".repeat(81), mclePeriod: "x".repeat(21) }))).toEqual(["ibpChapter", "mclePeriod"])
  })

  it("names what an application still needs, per country, in the API's order", () => {
    expect(missingFromForm(blank)).toEqual(["regulator", "registrationNumber", "qualifiedJurisdictions", "practiceAreas"])
    expect(missingFromForm({ ...blank, registrationNumber: "   " })).toContain("registrationNumber")
    expect(missingFromForm(formFromProfile(profile))).toEqual([])
    expect(missingFromForm({ ...blank, country: "PH" })).toEqual(["rollNumber", "ibpChapter", "practiceAreas"])
    expect(missingFromForm(formFromProfile(phProfile))).toEqual([])
  })

  it("flags the UK edits that send an application back for review", () => {
    const form = formFromProfile(profile)
    expect(needsRecheck(profile, form)).toBe(false)
    expect(needsRecheck(profile, { ...form, bio: "New bio", practiceAreas: ["FAMILY"], fee: "200" })).toBe(false)
    expect(needsRecheck(profile, { ...form, registrationNumber: " 123456 " })).toBe(false)
    expect(needsRecheck(profile, { ...form, regulator: "LSS" })).toBe(true)
    expect(needsRecheck(profile, { ...form, registrationNumber: "654321" })).toBe(true)
    expect(needsRecheck(profile, { ...form, qualifiedJurisdictions: ["England and Wales", "Scotland"] })).toBe(true)
  })

  it("flags the PH edits that send an application back for review: Roll number or IBP chapter only", () => {
    const form = formFromProfile(phProfile)
    expect(needsRecheck(phProfile, form)).toBe(false)
    expect(needsRecheck(phProfile, { ...form, mcleNumber: "VIII-1", ibpMembershipNumber: "L-9" })).toBe(false)
    expect(needsRecheck(phProfile, { ...form, rollNumber: "54321" })).toBe(true)
    expect(needsRecheck(phProfile, { ...form, ibpChapter: "Cebu City" })).toBe(true)
  })

  it("toggles a value in a list", () => {
    expect(toggle(["A"], "B")).toEqual(["A", "B"])
    expect(toggle(["A", "B"], "A")).toEqual(["B"])
  })
})
