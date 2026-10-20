import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { useCurrentUserQuery } from "@/lib/user/mutations"

/** The signed-in account's free AI credit (User.freeCreditUsd in the API) and what it has spent of
 * it (GET /api/users/me/free-credit), polled so it keeps up with work running in the background.
 * Undefined for an account with no credit (created before it existed) and until it loads. `spent`
 * once it is used up: the API then refuses new work with FREE_CREDIT_SPENT. */
export function useFreeCredit() {
  const { data: me } = useCurrentUserQuery()
  const hasCredit = me?.freeCreditUsd != null
  const { data } = useQuery({
    queryKey: ["free-credit"],
    queryFn: () => apiFetch<{ creditUsd: number | null; spentUsd?: number; spent?: boolean }>("/api/users/me/free-credit"),
    enabled: hasCredit,
    refetchInterval: 10_000,
  })
  if (!hasCredit || data?.creditUsd == null) return undefined
  const spentUsd = data.spentUsd ?? 0
  return { creditUsd: data.creditUsd, spentUsd, leftUsd: Math.max(0, data.creditUsd - spentUsd), spent: !!data.spent }
}
