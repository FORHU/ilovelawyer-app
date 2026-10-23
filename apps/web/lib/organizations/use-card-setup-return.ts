"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { getOrganizationCard, useSetOrganizationCardCache } from "@/lib/organizations/billing"

/**
 * Picks up after AddCardModal redirects the page to Stripe (or the dummy provider) and back
 * (ilovelawyer-api#505 — see organization-card.service.ts's startSetup). The return URL carries
 * `cardSetup=done&setupSessionId=...` or `cardSetup=cancelled`, appended by the API after
 * whatever the caller's own returnUrl already had — so any extra params AddCardModal was asked
 * to carry (e.g. the inbox's `resumeRequestId`) survive the round trip and come back in
 * `onDone`'s `params`, with the API's own two params already stripped.
 *
 * Runs once per redirect: strips its query params from the URL immediately, so a later reload
 * doesn't re-finalize the same session or re-fire `onDone`.
 */
export function useCardSetupReturn(
  organizationId: string | undefined,
  onDone?: (status: "done" | "cancelled", params: URLSearchParams) => void,
) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const setCardCache = useSetOrganizationCardCache()
  const { t } = useTranslation("organization")
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current || !organizationId) return
    const cardSetup = searchParams.get("cardSetup")
    if (cardSetup !== "done" && cardSetup !== "cancelled") return
    handled.current = true

    const setupSessionId = searchParams.get("setupSessionId") ?? undefined
    const remaining = new URLSearchParams(searchParams)
    remaining.delete("cardSetup")
    remaining.delete("setupSessionId")
    const query = remaining.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)

    if (cardSetup === "cancelled") {
      toast.info(t("billing.card.cancelledToast"))
      onDone?.("cancelled", remaining)
      return
    }

    getOrganizationCard(organizationId, setupSessionId)
      .then((card) => {
        setCardCache(organizationId, card)
        toast.success(t("billing.card.savedToast"))
        onDone?.("done", remaining)
      })
      .catch(() => {
        toast.error(t("billing.card.error"))
      })
    // Deliberately not re-run on onDone identity changes — `handled` already guards against
    // acting twice, and callers pass a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, searchParams, pathname, router, setCardCache, t])
}
