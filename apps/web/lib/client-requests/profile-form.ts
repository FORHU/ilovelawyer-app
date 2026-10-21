import type { ClientRequestProfile, ClientRequestProfilePatch, PracticeArea, Regulator } from "./profile"

/** The settings form's own state: text fields as typed, turned into the API's shapes on save. */
export interface ProfileForm {
  regulator: Regulator | null
  registrationNumber: string
  qualifiedJurisdictions: string[]
  practiceAreas: PracticeArea[]
  bio: string
  /** Comma-separated, as typed. */
  languages: string
  /** Pounds, as typed ("150" or "149.50"). Empty: no first-consultation offer. */
  fee: string
  /** YYYY-MM-DD, or empty. */
  pausedUntil: string
  /** Empty: no limit. */
  capacityLimit: string
}

export type ProfileFormErrors = Partial<Record<"registrationNumber" | "bio" | "fee" | "capacityLimit", string>>

export const BIO_MAX_LENGTH = 1500
const FEE_MAX_POUNDS = 10_000

export function formFromProfile(p: ClientRequestProfile): ProfileForm {
  return {
    regulator: p.regulator,
    registrationNumber: p.registrationNumber ?? "",
    qualifiedJurisdictions: p.qualifiedJurisdictions,
    practiceAreas: p.practiceAreas,
    bio: p.bio,
    languages: p.languages.join(", "),
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
  const fee = f.fee.trim().replace(/^£/, "")
  return {
    regulator: f.regulator,
    registrationNumber: f.registrationNumber.trim() || null,
    qualifiedJurisdictions: f.qualifiedJurisdictions,
    practiceAreas: f.practiceAreas,
    bio: f.bio,
    languages: [...new Set(f.languages.split(",").map((l) => l.trim()).filter(Boolean))],
    firstConsultationFee: fee ? { amountMinor: Math.round(Number(fee) * 100), currency: "GBP" } : null,
    pausedUntil: f.pausedUntil ? new Date(`${f.pausedUntil}T00:00:00Z`).toISOString() : null,
    capacityLimit: f.capacityLimit.trim() ? Number(f.capacityLimit) : null,
  }
}

/** Adds `value` to the list, or takes it out if it's there. */
export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
