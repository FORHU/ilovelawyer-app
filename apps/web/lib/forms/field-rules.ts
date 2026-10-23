/**
 * What the firm details and the Lawyer Application's fields may hold. The `keep*` filters run on
 * every change, so a character that can never be right (a letter in a phone number) can't be typed
 * or pasted in; the `*Problem` checks say what's wrong with a finished value. ilovelawyer-api checks
 * the same rules (src/constants/field-rules.ts), so a value the app lets through is never refused.
 */

/** Digits only: registration, firm, Roll and IBP membership numbers, a PH ZIP code. */
export const keepDigits = (v: string) => v.replace(/\D/g, "");

/** A phone number: digits and spaces, with an optional "+" in front for the country code. */
export function keepPhone(v: string) {
  const plus = v.trimStart().startsWith("+");
  return (plus ? "+" : "") + v.replace(/[^\d ]/g, "").replace(/ {2,}/g, " ");
}

/** A place or a name: letters (any language), spaces and . - ' ( ). For a city, an IBP chapter or a
 * language — never digits. */
export const keepWords = (v: string) => v.replace(/[^\p{L}\p{M} .'’()-]/gu, "");

/** A UK postcode as typed: letters, digits and a space, in capitals. */
export const keepUkPostcode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9 ]/g, "");

/** An MCLE compliance number, e.g. VII-0012345: capitals, digits and hyphens. */
export const keepMcleNumber = (v: string) => v.toUpperCase().replace(/[^A-Z0-9-]/g, "");

/** An MCLE compliance period, e.g. VII: Roman numerals. */
export const keepRomanNumeral = (v: string) => v.toUpperCase().replace(/[^IVXLCDM]/g, "");

/** An amount, e.g. 149.50: digits and one decimal point (a leading £ or ₱ is dropped). */
export function keepAmount(v: string) {
  const [whole, ...rest] = v.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole!;
}

export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 15;
export const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/;
export const PH_ZIP_CODE = /^\d{4}$/;
/** The longest registration, firm or Roll number: digits only. */
export const NUMBER_MAX_DIGITS = 10;

export function phoneProblem(v: string): string | null {
  if (!v.trim()) return null;
  const digits = keepDigits(v).length;
  return digits < PHONE_MIN_DIGITS || digits > PHONE_MAX_DIGITS ? `Enter a phone number of ${PHONE_MIN_DIGITS} to ${PHONE_MAX_DIGITS} digits.` : null;
}

export function postcodeProblem(v: string, country: "UK" | "PH" | null | undefined): string | null {
  const value = v.trim().toUpperCase();
  if (!value) return null;
  if (country === "UK") return UK_POSTCODE.test(value) ? null : "Enter a UK postcode, e.g. SW1A 1AA.";
  if (country === "PH") return PH_ZIP_CODE.test(value) ? null : "Enter a 4-digit ZIP code.";
  return null;
}
