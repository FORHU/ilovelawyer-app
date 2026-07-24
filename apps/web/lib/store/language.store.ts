import { create } from "zustand"
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/lib/i18n/languages"

const STORAGE_KEY = "displayLanguage"

interface LanguageState {
  language: SupportedLanguage
  setLanguage: (language: SupportedLanguage) => void
}

// Starts at DEFAULT_LANGUAGE (not read from localStorage) so the server-rendered
// markup and the client's first render always agree; I18nProvider reconciles
// against the persisted Language Preference after mount.
export const useLanguageStore = create<LanguageState>()((set) => ({
  language: DEFAULT_LANGUAGE,
  setLanguage: (language) => {
    localStorage.setItem(STORAGE_KEY, language)
    set({ language })
  },
}))

export function getStoredLanguage(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}
