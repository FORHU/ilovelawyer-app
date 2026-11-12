import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/lib/store/auth.store"
import { tenantI18nContext } from "@/config/tenant-codes"

/** The tour's `t`, in the signed-in organisation's jurisdiction: UK and KR users get a key's
 * `_UK` / `_KR` variant where tour.json has one (legislation and judgments instead of codals,
 * "Organisation"), falling back to the shared copy — the same i18next context convention as the
 * landing page. */
export function useTourT() {
  const { t } = useTranslation("tour")
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode)
  const context = tenantI18nContext(tenantCode)?.context
  const tourT = useCallback(
    (key: string, options?: Record<string, unknown>): string => t(key, { ...options, context }),
    [t, context],
  )
  return { t: tourT, tenantCode }
}
