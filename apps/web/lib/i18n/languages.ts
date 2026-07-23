export const SUPPORTED_LANGUAGES = ["en", "ko", "tl"] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = "en"

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  ko: "한국어",
  tl: "Tagalog",
}

export function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
}
