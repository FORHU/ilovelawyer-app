import {
  FEE_CURRENCY,
  FEE_DECIMALS,
  FEE_SYMBOL,
  type ClientRequestProfile,
  type ClientRequestProfilePatch,
  type KrLocalBar,
  type KrQualificationRoute,
  type LawyerCountry,
  type Regulator,
} from "./profile"
import { NUMBER_MAX_DIGITS } from "@/lib/forms/field-rules"

/** The application form's own state: text fields as typed, turned into the API's shapes on save.
 * It holds every country's registration fields; only the profile's own country's are shown and
 * sent. */
export interface ProfileForm {
  country: LawyerCountry
  // UK registration. `registrationNumber` is KR's Korean Bar Association number too.
  regulator: Regulator | null
  registrationNumber: string
  qualifiedJurisdictions: string[]
  // PH registration
  rollNumber: string
  ibpChapter: string
  ibpMembershipNumber: string
  mcleNumber: string
  mclePeriod: string
  // KR registration
  localBar: KrLocalBar | null
  qualificationRoute: KrQualificationRoute | null
  /** The bar exam round or JRTI class, as typed. Empty: not given. */
  qualificationCohort: string
  specialties: string[]
  /** YYYY-MM-DD, or empty. */
  registeredOn: string
  /** PracticeArea ids, as picked. */
  practiceAreaIds: string[]
  bio: string
  /** One per chip in the tag input, already trimmed and de-duplicated by it. */
  languages: string[]
  /** Major units, as typed: "150" or "149.50" in pounds or pesos, "100000" in won. Empty: no offer. */
  fee: string
  /** YYYY-MM-DD, or empty. */
  pausedUntil: string
  /** Empty: no limit. */
  capacityLimit: string
}

type TextField = "registrationNumber" | "rollNumber" | "ibpChapter" | "ibpMembershipNumber" | "mcleNumber" | "mclePeriod"
export type ProfileFormErrors = Partial<Record<TextField | "qualificationCohort" | "registeredOn" | "bio" | "fee" | "capacityLimit", string>>

export const BIO_MAX_LENGTH = 1500
/** The API's limits on languages: at most 10, each up to 40 characters. */
export const LANGUAGES_MAX = 10
export const LANGUAGE_MAX_LENGTH = 40
/** The API's limit on each registration text field. The numbers are digits only (see the field
 * filters in components/account/lawyer-application-fields.tsx and lib/forms/field-rules.ts). */
export const TEXT_MAX_LENGTH: Record<TextField, number> = {
  registrationNumber: NUMBER_MAX_DIGITS,
  rollNumber: NUMBER_MAX_DIGITS,
  ibpChapter: 80,
  ibpMembershipNumber: 20,
  mcleNumber: 40,
  mclePeriod: 10,
}
/** The API's ceiling on a bar exam round or JRTI class. */
export const KR_COHORT_MAX = 200
/** The highest first-consultation fee, in major units: the API's typo ceiling. */
const FEE_MAX: Record<LawyerCountry, number> = { UK: 10_000, PH: 10_000, KR: 10_000_000 }

const TEXT_FIELDS: Record<LawyerCountry, TextField[]> = {
  UK: ["registrationNumber"],
  PH: ["rollNumber", "ibpChapter", "ibpMembershipNumber", "mcleNumber", "mclePeriod"],
  KR: ["registrationNumber"],
}

/** Major units as the form shows them, from the API's minor units. */
function feeText(amountMinor: number, country: LawyerCountry): string {
  return String(amountMinor / 10 ** FEE_DECIMALS[country])
}

export function formFromProfile(p: ClientRequestProfile): ProfileForm {
  const uk = p.registration.country === "UK" ? p.registration : null
  const ph = p.registration.country === "PH" ? p.registration : null
  const kr = p.registration.country === "KR" ? p.registration : null
  return {
    country: p.country,
    regulator: uk?.regulator ?? null,
    registrationNumber: uk?.registrationNumber ?? kr?.registrationNumber ?? "",
    qualifiedJurisdictions: uk?.qualifiedJurisdictions ?? [],
    rollNumber: ph?.rollNumber ?? "",
    ibpChapter: ph?.ibpChapter ?? "",
    ibpMembershipNumber: ph?.ibpMembershipNumber ?? "",
    mcleNumber: ph?.mcleNumber ?? "",
    mclePeriod: ph?.mclePeriod ?? "",
    localBar: kr?.localBar ?? null,
    qualificationRoute: kr?.qualificationRoute ?? null,
    qualificationCohort: kr?.qualificationCohort == null ? "" : String(kr.qualificationCohort),
    specialties: kr?.specialties ?? [],
    registeredOn: kr?.registeredOn ?? "",
    practiceAreaIds: p.practiceAreas.map((a) => a.id),
    bio: p.bio,
    languages: p.languages,
    fee: p.firstConsultationFee ? feeText(p.firstConsultationFee.amountMinor, p.country) : "",
    pausedUntil: p.pausedUntil ? p.pausedUntil.slice(0, 10) : "",
    capacityLimit: p.capacityLimit === null ? "" : String(p.capacityLimit),
  }
}

/** The fee as typed, without a leading currency symbol or thousands separators. */
function typedFee(f: Pick<ProfileForm, "fee">): string {
  return f.fee.trim().replace(/^[£₱₩]/, "").replace(/,/g, "")
}

/** Messages keyed by field, empty when the form can be saved. Mirrors the API's limits. */
export function validateForm(f: ProfileForm, today: string = new Date().toISOString().slice(0, 10)): ProfileFormErrors {
  const errors: ProfileFormErrors = {}
  for (const field of TEXT_FIELDS[f.country]) {
    if (f[field].trim().length > TEXT_MAX_LENGTH[field]) errors[field] = `Use ${TEXT_MAX_LENGTH[field]} characters or fewer.`
  }
  if (f.country === "KR") {
    if (f.qualificationCohort.trim()) {
      const n = Number(f.qualificationCohort)
      if (!Number.isInteger(n) || n < 1 || n > KR_COHORT_MAX) errors.qualificationCohort = `Enter a whole number from 1 to ${KR_COHORT_MAX}.`
    }
    if (f.registeredOn && f.registeredOn > today) errors.registeredOn = "Enter a date that isn't in the future."
  }
  if (f.bio.length > BIO_MAX_LENGTH) errors.bio = `Use ${BIO_MAX_LENGTH} characters or fewer.`
  if (f.fee.trim()) {
    const typed = typedFee(f)
    const pattern = FEE_DECIMALS[f.country] === 0 ? /^\d+$/ : /^\d+(\.\d{1,2})?$/
    // Checked as text: 0.29 * 100 isn't exactly 29 in floating point.
    if (!pattern.test(typed) || Number(typed) > FEE_MAX[f.country]) {
      errors.fee = `Enter an amount up to ${FEE_SYMBOL[f.country]}${FEE_MAX[f.country].toLocaleString("en-GB")}.`
    }
  }
  if (f.capacityLimit.trim()) {
    const n = Number(f.capacityLimit)
    if (!Number.isInteger(n) || n < 1 || n > 100) errors.capacityLimit = "Enter a whole number from 1 to 100, or leave it empty for no limit."
  }
  return errors
}

/** What to send on save. The accepting switch saves on its own, so it's never part of this. */
export function patchFromForm(f: ProfileForm): ClientRequestProfilePatch {
  return { ...applicationPatchFromForm(f), ...availabilityPatchFromForm(f) }
}

const textOrNull = (v: string) => v.trim() || null

function registrationPatch(f: ProfileForm): ClientRequestProfilePatch["registration"] {
  switch (f.country) {
    case "PH":
      return {
        country: "PH",
        rollNumber: textOrNull(f.rollNumber),
        ibpChapter: textOrNull(f.ibpChapter),
        ibpMembershipNumber: textOrNull(f.ibpMembershipNumber),
        mcleNumber: textOrNull(f.mcleNumber),
        mclePeriod: textOrNull(f.mclePeriod),
      }
    case "KR":
      return {
        country: "KR",
        registrationNumber: textOrNull(f.registrationNumber),
        localBar: f.localBar,
        qualificationRoute: f.qualificationRoute,
        qualificationCohort: f.qualificationCohort.trim() ? Number(f.qualificationCohort) : null,
        specialties: f.specialties,
        registeredOn: f.registeredOn || null,
      }
    case "UK":
      return {
        country: "UK",
        regulator: f.regulator,
        registrationNumber: textOrNull(f.registrationNumber),
        qualifiedJurisdictions: f.qualifiedJurisdictions,
      }
  }
}

/** The application's fields: the profile's own country's registration, what the lawyer takes on,
 * and what clients see. */
export function applicationPatchFromForm(f: ProfileForm): ClientRequestProfilePatch {
  const fee = typedFee(f)
  return {
    registration: registrationPatch(f),
    practiceAreaIds: f.practiceAreaIds,
    bio: f.bio,
    languages: f.languages,
    firstConsultationFee: fee ? { amountMinor: Math.round(Number(fee) * 10 ** FEE_DECIMALS[f.country]), currency: FEE_CURRENCY[f.country] } : null,
  }
}

/** Pause and capacity, set beside the accepting switch once a UK application is approved. */
export function availabilityPatchFromForm(f: Pick<ProfileForm, "pausedUntil" | "capacityLimit">): ClientRequestProfilePatch {
  return {
    pausedUntil: f.pausedUntil ? new Date(`${f.pausedUntil}T00:00:00Z`).toISOString() : null,
    capacityLimit: f.capacityLimit.trim() ? Number(f.capacityLimit) : null,
  }
}

export type RequiredField = "regulator" | "registrationNumber" | "qualifiedJurisdictions" | "rollNumber" | "ibpChapter" | "localBar" | "practiceAreas"

/** What an application still needs before it can be submitted. Mirrors the API's missingFields,
 * in the same order, so the names match profile.missing. */
export function missingFromForm(f: ProfileForm): RequiredField[] {
  const missing: RequiredField[] = []
  if (f.country === "PH") {
    if (!f.rollNumber.trim()) missing.push("rollNumber")
    if (!f.ibpChapter.trim()) missing.push("ibpChapter")
  } else if (f.country === "KR") {
    if (!f.registrationNumber.trim()) missing.push("registrationNumber")
    if (!f.localBar) missing.push("localBar")
  } else {
    if (!f.regulator) missing.push("regulator")
    if (!f.registrationNumber.trim()) missing.push("registrationNumber")
    if (f.qualifiedJurisdictions.length === 0) missing.push("qualifiedJurisdictions")
  }
  if (f.practiceAreaIds.length === 0) missing.push("practiceAreas")
  return missing
}

const sameText = (a: string | null, b: string) => (a ?? "").trim() === b.trim()

/** Whether saving this form sends an approved or rejected application back for review: the API
 * re-checks UK regulator, number or jurisdictions, PH Roll number or IBP chapter, and KR
 * registration number or local bar. */
export function needsRecheck(p: ClientRequestProfile, f: ProfileForm): boolean {
  const r = p.registration
  if (r.country === "PH") return !sameText(r.rollNumber, f.rollNumber) || !sameText(r.ibpChapter, f.ibpChapter)
  if (r.country === "KR") return !sameText(r.registrationNumber, f.registrationNumber) || r.localBar !== f.localBar
  const sameJurisdictions =
    r.qualifiedJurisdictions.length === f.qualifiedJurisdictions.length && r.qualifiedJurisdictions.every((j) => f.qualifiedJurisdictions.includes(j))
  return r.regulator !== f.regulator || !sameText(r.registrationNumber, f.registrationNumber) || !sameJurisdictions
}

/** Adds `value` to the list, or takes it out if it's there. */
export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
