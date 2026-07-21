"use client"

import { useEffect } from "react"
import { I18nextProvider } from "react-i18next"
import i18n from "@/lib/i18n/i18n"
import { isSupportedLanguage } from "@/lib/i18n/languages"
import { getStoredLanguage, useLanguageStore } from "@/lib/store/language.store"

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useLanguageStore((state) => state.language)
  const setLanguage = useLanguageStore((state) => state.setLanguage)

  // Reconciles against the persisted Language Preference once, client-only, after
  // the first render — keeps the server-rendered English markup and the client's
  // first render in agreement, then switches if the user had picked something else.
  useEffect(() => {
    const stored = getStoredLanguage()
    if (isSupportedLanguage(stored) && stored !== language) {
      setLanguage(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    i18n.changeLanguage(language)
  }, [language])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
