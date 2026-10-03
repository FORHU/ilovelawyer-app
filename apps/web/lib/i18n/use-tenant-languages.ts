"use client"

import { useEffect } from "react"
import { getTenantCodeConfig } from "@/config/tenant-codes"
import { useTenantCodeHint } from "@/components/tenant-code-provider"
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import { useAuthStore } from "@/lib/store/auth.store"
import { useLanguageStore } from "@/lib/store/language.store"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"

/** The display languages this site offers — the signed-in organization's tenant, else the
 * hostname's (`tenantCode` overrides both, for components already handed one). An unrecognized
 * host offers every language. A stored choice the tenant doesn't offer (Tagalog picked on the PH
 * site, then visiting the UK one) falls back to the default. */
export function useTenantLanguages(tenantCode?: TenantCode | null): readonly SupportedLanguage[] {
  const hint = useTenantCodeHint()
  const orgTenant = useAuthStore((s) => s.organization?.tenantCode)
  const tenant = tenantCode ?? orgTenant ?? hint
  const languages = tenant ? getTenantCodeConfig(tenant).languages : SUPPORTED_LANGUAGES
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)

  useEffect(() => {
    if (!languages.includes(language)) setLanguage(DEFAULT_LANGUAGE)
  }, [languages, language, setLanguage])

  return languages
}
