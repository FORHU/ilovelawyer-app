import i18next from "i18next"
import { useAuthStore } from "@/lib/store/auth.store"
import { resolveTenantCodeFromHost, type TenantCode } from "@/lib/tenant-code/resolve-host"
import { getTenantCodeConfig } from "@/config/tenant-codes"

/** The BCP 47 locale to format dates with. English follows the tenant's convention — en-GB on
 * the UK site ("2 Oct 2026", 02/10/2026), en-PH on the PH site — instead of the browser's
 * locale or i18next's bare "en", which both default to US month/day order. Korean and Tagalog
 * keep their own locale. */
export function dateLocaleFor(language: string | undefined, tenantCode: TenantCode | null | undefined): string | undefined {
  const lang = language || "en"
  if (!lang.startsWith("en")) return lang
  return tenantCode ? getTenantCodeConfig(tenantCode).locale : undefined
}

/** The signed-in organization's tenant wins; the hostname stands in before it loads (and on
 * public pages). */
function currentTenantCode(): TenantCode | null {
  return (
    useAuthStore.getState().organization?.tenantCode ??
    (typeof window !== "undefined" ? resolveTenantCodeFromHost(window.location.host) : null)
  )
}

/** Non-hook read, for formatters outside React. */
export function dateLocale(): string | undefined {
  return dateLocaleFor(i18next.language, currentTenantCode())
}

/** Hook form: re-renders when the organization (and so its tenant) changes. */
export function useDateLocale(): string | undefined {
  useAuthStore((s) => s.organization?.tenantCode)
  return dateLocale()
}

/** date-fns `weekStartsOn`: Monday on the UK site (UK convention), Sunday on the PH site. */
export function useWeekStartsOn(): 0 | 1 {
  useAuthStore((s) => s.organization?.tenantCode)
  return currentTenantCode() === "UK" ? 1 : 0
}
