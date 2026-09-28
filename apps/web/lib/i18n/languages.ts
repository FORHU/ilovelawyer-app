// `en-GB` is derived from `en` at load time: British spelling by transform, plus hand-written
// overrides for the legal terms UK practice uses (claimant, not petitioner) — see
// lib/i18n/british.ts. So a new English string needs adding to `en` alone unless its wording is
// jurisdiction-specific. Distinct from the `_UK` key suffix, which is chosen by the organization's
// Tenant rather than by the reader — see components/landing/terminal-mock-window.tsx.
export const SUPPORTED_LANGUAGES = ["en", "en-GB", "ko", "tl"] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = "en"

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  "en-GB": "English (UK)",
  ko: "한국어",
  tl: "Tagalog",
}

export function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
}
