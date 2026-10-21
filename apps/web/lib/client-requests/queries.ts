import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { dateLocale } from "@/lib/i18n/date-locale"
import { MOCK_CLIENT_REQUESTS } from "./mock-data"
import type { ClientRequest, RequestUrgency } from "./types"

export const clientRequestKeys = {
  all: ["client-requests"] as const,
  list: (empty: boolean) => ["client-requests", "list", { empty }] as const,
}

/** `?state=empty` previews the empty inbox until real data exists. */
export function useClientRequestsQuery() {
  const empty = useSearchParams().get("state") === "empty"
  return useQuery({
    queryKey: clientRequestKeys.list(empty),
    queryFn: async (): Promise<ClientRequest[]> => (empty ? [] : MOCK_CLIENT_REQUESTS),
    staleTime: Infinity,
  })
}

export function useClientRequestQuery(id: string) {
  const { data, isLoading, isError, refetch } = useClientRequestsQuery()
  return { request: data?.find((r) => r.id === id), isLoading, isError, refetch }
}

/** Requests still waiting for a lawyer — the badge on the nav tab. */
export function useOpenClientRequestCount(): number {
  const { data } = useClientRequestsQuery()
  return data?.filter((r) => r.status === "open").length ?? 0
}

export const URGENCY_RANK: Record<RequestUrgency, number> = { high: 0, medium: 1, low: 2 }

/** "2 hours ago", "1 day ago" in the tenant's locale. */
export function formatTimeAgo(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat(dateLocale(), { numeric: "always" })
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return rtf.format(-minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(-hours, "hour")
  return rtf.format(-Math.round(hours / 24), "day")
}
