import type { ClientRequestProfile, ClientRequestProfilePatch, PracticeArea, Regulator } from "./profile"

/** The settings form's own state: text fields as typed, turned into the API's shapes on save. */
export interface ProfileForm {
  regulator: Regulator | null
  registrationNumber: string
  qualifiedJurisdictions: string[]
  practiceAreas: PracticeArea[]
  bio: string
  /** One per chip in the tag input, already trimmed and de-duplicated by it. */
  languages: string[]
  /** Pounds, as typed ("150" or "149.50"). Empty: no first-consultation offer. */
  fee: string
  /** YYYY-MM-DD, or empty. */
  pausedUntil: string
  /** Empty: no limit. */
  capacityLimit: string
}

export type ProfileFormErrors = Partial<Record<"registrationNumber" | "bio" | "fee" | "capacityLimit", string>>

export const BIO_MAX_LENGTH = 1500
/** The API's limits on languages: at most 10, each up to 40 characters. */
export const LANGUAGES_MAX = 10
export const LANGUAGE_MAX_LENGTH = 40
const FEE_MAX_POUNDS = 10_000

export function formFromProfile(p: ClientRequestProfile): ProfileForm {
  return {
    regulator: p.regulator,
    registrationNumber: p.registrationNumber ?? "",
    qualifiedJurisdictions: p.qualifiedJurisdictions,
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
  if (f.registrationNumber.trim().length > 40) errors.registrationNumber = "Use 40 characters or fewer."
  if (f.bio.length > BIO_MAX_LENGTH) errors.bio = `Use ${BIO_MAX_LENGTH} characters or fewer.`
  if (f.fee.trim()) {
    const typed = f.fee.trim().replace(/^£/, "")
    // Checked as text: 0.29 * 100 isn't exactly 29 in floating point.
    if (!/^\d+(\.\d{1,2})?$/.test(typed) || Number(typed) > FEE_MAX_POUNDS) {
      errors.fee = `Enter an amount in pounds, up to £${FEE_MAX_POUNDS.toLocaleString("en-GB")}.`
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

/** The application dialog's fields: what the admin checks, and what clients see. */
export function applicationPatchFromForm(f: ProfileForm): ClientRequestProfilePatch {
  const fee = f.fee.trim().replace(/^£/, "")
  return {
    regulator: f.regulator,
    registrationNumber: f.registrationNumber.trim() || null,
    qualifiedJurisdictions: f.qualifiedJurisdictions,
    practiceAreas: f.practiceAreas,
    bio: f.bio,
    languages: f.languages,
    firstConsultationFee: fee ? { amountMinor: Math.round(Number(fee) * 100), currency: "GBP" } : null,
  }
}

/** Pause and capacity, set beside the accepting switch once the application is approved. */
export function availabilityPatchFromForm(f: Pick<ProfileForm, "pausedUntil" | "capacityLimit">): ClientRequestProfilePatch {
  return {
    pausedUntil: f.pausedUntil ? new Date(`${f.pausedUntil}T00:00:00Z`).toISOString() : null,
    capacityLimit: f.capacityLimit.trim() ? Number(f.capacityLimit) : null,
  }
}

export type RequiredField = "regulator" | "registrationNumber" | "qualifiedJurisdictions" | "practiceAreas"

/** What an application still needs before it can be submitted. Mirrors the API's missingFields,
 * in the same order, so the names match profile.missing. */
export function missingFromForm(f: ProfileForm): RequiredField[] {
  const missing: RequiredField[] = []
  if (!f.regulator) missing.push("regulator")
  if (!f.registrationNumber.trim()) missing.push("registrationNumber")
  if (f.qualifiedJurisdictions.length === 0) missing.push("qualifiedJurisdictions")
  if (f.practiceAreas.length === 0) missing.push("practiceAreas")
  return missing
}

/** Whether saving this form sends an approved or rejected application back for review: the API
 * re-checks when who regulates them, their number or where they're qualified changes. */
export function needsRecheck(p: ClientRequestProfile, f: ProfileForm): boolean {
  const sameJurisdictions =
    p.qualifiedJurisdictions.length === f.qualifiedJurisdictions.length && p.qualifiedJurisdictions.every((j) => f.qualifiedJurisdictions.includes(j))
  return p.regulator !== f.regulator || (p.registrationNumber ?? "").trim() !== f.registrationNumber.trim() || !sameJurisdictions
}

/** Adds `value` to the list, or takes it out if it's there. */
export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
