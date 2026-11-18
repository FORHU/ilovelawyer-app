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
  practiceAreas: [{ id: "uk-employment", name: "Employment Law", isActive: true }],
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
  practiceAreas: [{ id: "ph-labor", name: "Labor and Employment Law", isActive: true }],
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
  localBar: null,
  qualificationRoute: null,
  qualificationCohort: "",
  specialties: [],
  registeredOn: "",
  practiceAreaIds: [],
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
      practiceAreaIds: ["uk-employment"],
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

  it("keeps a switched-off practice area the lawyer holds, sending its id back", () => {
    const held = { ...profile, practiceAreas: [...profile.practiceAreas, { id: "uk-retired", name: "Retired Law", isActive: false }] }
    expect(applicationPatchFromForm(formFromProfile(held)).practiceAreaIds).toEqual(["uk-employment", "uk-retired"])
  })

  it("splits the save between the application and the availability settings", () => {
    const form = formFromProfile(profile)
    expect(Object.keys(applicationPatchFromForm(form)).sort()).toEqual(["bio", "firstConsultationFee", "languages", "practiceAreaIds", "registration"])
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
    expect(needsRecheck(profile, { ...form, bio: "New bio", practiceAreaIds: ["uk-family"], fee: "200" })).toBe(false)
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

const krProfile: ClientRequestProfile = {
  ...profile,
  country: "KR",
  registration: { country: "KR", registrationNumber: "12345", localBar: "SEOUL", qualificationRoute: "BAR_EXAM", qualificationCohort: 9, specialties: ["가사법"], registeredOn: "2020-04-01" },
  practiceAreas: [{ id: "kr-civil", name: "민사 (Civil Law)", isActive: true }],
  firstConsultationFee: { amountMinor: 100000, currency: "KRW" },
}

describe("Lawyer Application form (KR)", () => {
  it("round-trips a saved KR profile, with the fee in whole won", () => {
    const form = formFromProfile(krProfile)
    expect(form).toMatchObject({ registrationNumber: "12345", localBar: "SEOUL", qualificationRoute: "BAR_EXAM", qualificationCohort: "9", specialties: ["가사법"], registeredOn: "2020-04-01", fee: "100000" })
    expect(applicationPatchFromForm(form)).toMatchObject({
      registration: { country: "KR", registrationNumber: "12345", localBar: "SEOUL", qualificationRoute: "BAR_EXAM", qualificationCohort: 9, specialties: ["가사법"], registeredOn: "2020-04-01" },
      firstConsultationFee: { amountMinor: 100000, currency: "KRW" },
    })
  })

  it("needs the registration number, local bar and a practice area", () => {
    expect(missingFromForm({ ...blank, country: "KR" })).toEqual(["registrationNumber", "localBar", "practiceAreas"])
    expect(missingFromForm(formFromProfile(krProfile))).toEqual([])
  })

  it("takes whole won only, a cohort from 1 to 200 and a registration date that isn't in the future", () => {
    const form = { ...formFromProfile(krProfile) }
    expect(validateForm(form, "2026-11-13")).toEqual({})
    expect(validateForm({ ...form, fee: "1000.50" }, "2026-11-13").fee).toBeDefined()
    expect(validateForm({ ...form, fee: "₩10,000,000" }, "2026-11-13").fee).toBeUndefined()
    expect(validateForm({ ...form, fee: "10000001" }, "2026-11-13").fee).toBeDefined()
    expect(validateForm({ ...form, qualificationCohort: "0" }, "2026-11-13").qualificationCohort).toBeDefined()
    expect(validateForm({ ...form, registeredOn: "2026-11-14" }, "2026-11-13").registeredOn).toBeDefined()
  })

  it("sends an approved application back for review on the number or local bar, not the optional fields", () => {
    const form = formFromProfile(krProfile)
    expect(needsRecheck(krProfile, { ...form, specialties: ["가사법", "이혼"], qualificationCohort: "10" })).toBe(false)
    expect(needsRecheck(krProfile, { ...form, localBar: "BUSAN" })).toBe(true)
    expect(needsRecheck(krProfile, { ...form, registrationNumber: "54321" })).toBe(true)
  })
})
