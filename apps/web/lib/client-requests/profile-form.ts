import { FEE_CURRENCY, type ClientRequestProfile, type ClientRequestProfilePatch, type LawyerCountry, type Regulator } from "./profile"

/** The application form's own state: text fields as typed, turned into the API's shapes on save.
 * It holds both countries' registration fields; only the profile's own country's are shown and
 * sent. */
export interface ProfileForm {
  country: LawyerCountry
  // UK registration
  regulator: Regulator | null
  registrationNumber: string
  qualifiedJurisdictions: string[]
  // PH registration
  rollNumber: string
  ibpChapter: string
  ibpMembershipNumber: string
  mcleNumber: string
  mclePeriod: string
  practiceAreas: string[]
  bio: string
  /** One per chip in the tag input, already trimmed and de-duplicated by it. */
  languages: string[]
  /** Major units, as typed ("150" or "149.50"): pounds on UK, pesos on PH. Empty: no offer. */
  fee: string
  /** YYYY-MM-DD, or empty. */
  pausedUntil: string
  /** Empty: no limit. */
  capacityLimit: string
}

type TextField = "registrationNumber" | "rollNumber" | "ibpChapter" | "ibpMembershipNumber" | "mcleNumber" | "mclePeriod"
export type ProfileFormErrors = Partial<Record<TextField | "bio" | "fee" | "capacityLimit", string>>

export const BIO_MAX_LENGTH = 1500
/** The API's limits on languages: at most 10, each up to 40 characters. */
export const LANGUAGES_MAX = 10
export const LANGUAGE_MAX_LENGTH = 40
/** The API's limit on each registration text field. */
export const TEXT_MAX_LENGTH: Record<TextField, number> = {
  registrationNumber: 40,
  rollNumber: 40,
  ibpChapter: 80,
  ibpMembershipNumber: 40,
  mcleNumber: 40,
  mclePeriod: 20,
}
const FEE_MAX = 10_000

export function formFromProfile(p: ClientRequestProfile): ProfileForm {
  const uk = p.registration.country === "UK" ? p.registration : null
  const ph = p.registration.country === "PH" ? p.registration : null
  return {
    country: p.country,
    regulator: uk?.regulator ?? null,
    registrationNumber: uk?.registrationNumber ?? "",
    qualifiedJurisdictions: uk?.qualifiedJurisdictions ?? [],
    rollNumber: ph?.rollNumber ?? "",
    ibpChapter: ph?.ibpChapter ?? "",
    ibpMembershipNumber: ph?.ibpMembershipNumber ?? "",
    mcleNumber: ph?.mcleNumber ?? "",
    mclePeriod: ph?.mclePeriod ?? "",
    practiceAreas: p.practiceAreas,
    bio: p.bio,
    languages: p.languages,
    fee: p.firstConsultationFee ? String(p.firstConsultationFee.amountMinor / 100) : "",
    pausedUntil: p.pausedUntil ? p.pausedUntil.slice(0, 10) : "",
    capacityLimit: p.capacityLimit === null ? "" : String(p.capacityLimit),
  }
}

/** Messages keyed by field, empty when the form can be saved. Mirrors the API's limits. */
export function validateForm(f: ProfileForm): ProfileFormErrors {
  const errors: ProfileFormErrors = {}
  const textFields: TextField[] = f.country === "PH" ? ["rollNumber", "ibpChapter", "ibpMembershipNumber", "mcleNumber", "mclePeriod"] : ["registrationNumber"]
  for (const field of textFields) {
    if (f[field].trim().length > TEXT_MAX_LENGTH[field]) errors[field] = `Use ${TEXT_MAX_LENGTH[field]} characters or fewer.`
  }
  if (f.bio.length > BIO_MAX_LENGTH) errors.bio = `Use ${BIO_MAX_LENGTH} characters or fewer.`
  if (f.fee.trim()) {
    const symbol = f.country === "PH" ? "₱" : "£"
    const typed = f.fee.trim().replace(/^[£₱]/, "")
    // Checked as text: 0.29 * 100 isn't exactly 29 in floating point.
    if (!/^\d+(\.\d{1,2})?$/.test(typed) || Number(typed) > FEE_MAX) {
      errors.fee = `Enter an amount up to ${symbol}${FEE_MAX.toLocaleString("en-GB")}.`
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

/** The application's fields: the profile's own country's registration, what the lawyer takes on,
 * and what clients see. */
export function applicationPatchFromForm(f: ProfileForm): ClientRequestProfilePatch {
  const fee = f.fee.trim().replace(/^[£₱]/, "")
  return {
    registration:
      f.country === "PH"
        ? {
            country: "PH",
            rollNumber: textOrNull(f.rollNumber),
            ibpChapter: textOrNull(f.ibpChapter),
            ibpMembershipNumber: textOrNull(f.ibpMembershipNumber),
            mcleNumber: textOrNull(f.mcleNumber),
            mclePeriod: textOrNull(f.mclePeriod),
          }
        : {
            country: "UK",
            regulator: f.regulator,
            registrationNumber: textOrNull(f.registrationNumber),
            qualifiedJurisdictions: f.qualifiedJurisdictions,
          },
    practiceAreas: f.practiceAreas,
    bio: f.bio,
    languages: f.languages,
    firstConsultationFee: fee ? { amountMinor: Math.round(Number(fee) * 100), currency: FEE_CURRENCY[f.country] } : null,
  }
}

/** Pause and capacity, set beside the accepting switch once a UK application is approved. */
export function availabilityPatchFromForm(f: Pick<ProfileForm, "pausedUntil" | "capacityLimit">): ClientRequestProfilePatch {
  return {
    pausedUntil: f.pausedUntil ? new Date(`${f.pausedUntil}T00:00:00Z`).toISOString() : null,
    capacityLimit: f.capacityLimit.trim() ? Number(f.capacityLimit) : null,
  }
}

export type RequiredField = "regulator" | "registrationNumber" | "qualifiedJurisdictions" | "rollNumber" | "ibpChapter" | "practiceAreas"

/** What an application still needs before it can be submitted. Mirrors the API's missingFields,
 * in the same order, so the names match profile.missing. */
export function missingFromForm(f: ProfileForm): RequiredField[] {
  const missing: RequiredField[] = []
  if (f.country === "PH") {
    if (!f.rollNumber.trim()) missing.push("rollNumber")
    if (!f.ibpChapter.trim()) missing.push("ibpChapter")
  } else {
    if (!f.regulator) missing.push("regulator")
    if (!f.registrationNumber.trim()) missing.push("registrationNumber")
    if (f.qualifiedJurisdictions.length === 0) missing.push("qualifiedJurisdictions")
  }
  if (f.practiceAreas.length === 0) missing.push("practiceAreas")
  return missing
}

const sameText = (a: string | null, b: string) => (a ?? "").trim() === b.trim()

/** Whether saving this form sends an approved or rejected application back for review: the API
 * re-checks UK regulator, number or jurisdictions, and PH Roll number or IBP chapter. */
export function needsRecheck(p: ClientRequestProfile, f: ProfileForm): boolean {
  const r = p.registration
  if (r.country === "PH") return !sameText(r.rollNumber, f.rollNumber) || !sameText(r.ibpChapter, f.ibpChapter)
  const sameJurisdictions =
    r.qualifiedJurisdictions.length === f.qualifiedJurisdictions.length && r.qualifiedJurisdictions.every((j) => f.qualifiedJurisdictions.includes(j))
  return r.regulator !== f.regulator || !sameText(r.registrationNumber, f.registrationNumber) || !sameJurisdictions
}

/** Adds `value` to the list, or takes it out if it's there. */
export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
