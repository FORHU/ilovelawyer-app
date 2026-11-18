"use client"

import { useEffect } from "react"
import { I18nextProvider } from "react-i18next"
import i18n from "@/lib/i18n/i18n"
import { isSupportedLanguage } from "@/lib/i18n/languages"
import { getStoredLanguage, useLanguageStore } from "@/lib/store/language.store"
import { getTenantCodeConfig } from "@/config/tenant-codes"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"

export function I18nProvider({
  tenantCodeHint = null,
  children,
}: {
  /** The hostname's tenant, so a first visit gets that site's default language (Korean on KR). */
  tenantCodeHint?: TenantCode | null
  children: React.ReactNode
}) {
  const language = useLanguageStore((state) => state.language)
  const setLanguage = useLanguageStore((state) => state.setLanguage)

  // Reconciles against the persisted Language Preference once, client-only, after
  // the first render — keeps the server-rendered English markup and the client's
  // first render in agreement, then switches if the user had picked something else.
  // With no stored choice, the site's default applies. It isn't persisted, so it never
  // follows the visitor to another site as if they had picked it.
  useEffect(() => {
    const stored = getStoredLanguage()
    if (isSupportedLanguage(stored)) {
      if (stored !== language) setLanguage(stored)
    } else if (tenantCodeHint) {
      const siteDefault = getTenantCodeConfig(tenantCodeHint).defaultLanguage
      if (siteDefault !== language) useLanguageStore.setState({ language: siteDefault })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    i18n.changeLanguage(language)
  }, [language])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
