import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { useCurrentUserQuery } from "@/lib/user/mutations"
import type { Price } from "@/lib/money"

/** The signed-in account's free AI credit (User.freeCreditUsd in the API) and what it has spent of
 * it (GET /api/users/me/free-credit), polled so it keeps up with work running in the background.
 * Undefined for an account with no credit (created before it existed) and until it loads. `spent`
 * once it is used up: the API then refuses new work with FREE_CREDIT_SPENT. `display` is the credit
 * and what's left in the site's currency (won on KR), for showing; the dollar figures are for logic. */
export function useFreeCredit() {
  const { data: me } = useCurrentUserQuery()
  const hasCredit = me?.freeCreditUsd != null
  const { data } = useQuery({
    queryKey: ["free-credit"],
    queryFn: () =>
      apiFetch<{ creditUsd: number | null; spentUsd?: number; spent?: boolean; display?: { credit: Price; left: Price } }>("/api/users/me/free-credit"),
    enabled: hasCredit,
    refetchInterval: 10_000,
  })
  if (!hasCredit || data?.creditUsd == null) return undefined
  const spentUsd = data.spentUsd ?? 0
  const leftUsd = Math.max(0, data.creditUsd - spentUsd)
  // An API without `display` yet sends dollars.
  const display = data.display ?? { credit: { amountMinor: Math.round(data.creditUsd * 100), currency: "USD" }, left: { amountMinor: Math.round(leftUsd * 100), currency: "USD" } }
  return { creditUsd: data.creditUsd, spentUsd, leftUsd, spent: !!data.spent, display }
}
