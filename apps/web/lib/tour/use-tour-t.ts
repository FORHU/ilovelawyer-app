import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/lib/store/auth.store"

/** The tour's `t`, in the signed-in organisation's jurisdiction: UK users get a key's `_UK`
 * variant where tour.json has one (legislation and judgments instead of codals, "Organisation"),
 * falling back to the shared copy — the same i18next context convention as the landing page. */
export function useTourT() {
  const { t } = useTranslation("tour")
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode)
  const context = tenantCode === "UK" ? "UK" : undefined
  const tourT = useCallback(
    (key: string, options?: Record<string, unknown>): string => t(key, { ...options, context }),
    [t, context],
  )
  return { t: tourT, tenantCode }
}
