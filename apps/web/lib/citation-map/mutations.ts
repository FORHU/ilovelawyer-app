import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import type { CitationMapSeed, CitationEdgesResponse } from "./types"

export const citationMapKeys = {
  all: ["citation-map"] as const,
  seed: (caseId: string) => [...citationMapKeys.all, "seed", caseId] as const,
  edges: (lawId: string) => [...citationMapKeys.all, "edges", lawId] as const,
}

export function useCitationMapQuery(caseId: string) {
  return useQuery({
    queryKey: citationMapKeys.seed(caseId),
    queryFn: () => apiFetch<CitationMapSeed>(`/api/my-cases/${caseId}/citation-map`),
    enabled: !!caseId,
  })
}

/** Kicks off (or returns already-cached) citation extraction for a Law node. Callers should
 * follow up with useCitationEdgesQuery(lawId, true) to poll until it's actually done — this
 * mutation only reports whether it started, not whether it finished. */
export function useExpandCitationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (lawId: string) => apiFetch<CitationEdgesResponse>(`/api/law/${lawId}/citations/expand`, { method: "POST" }),
    onSuccess: (_data, lawId) => {
      queryClient.invalidateQueries({ queryKey: citationMapKeys.edges(lawId) })
    },
  })
}

const POLL_INTERVAL_MS = 3000
// Client-side safety net (~90s) — a backend job interrupted mid-flight (e.g. a server restart)
// never flips status to DONE, so nothing here would otherwise stop polling on its own.
const MAX_POLLS = 30

/** Polls GET /api/law/:lawId/citations until extraction finishes. Pass `enabled: true` once
 * useExpandCitationMutation has been called for this lawId. */
export function useCitationEdgesQuery(lawId: string, enabled: boolean) {
  return useQuery({
    queryKey: citationMapKeys.edges(lawId),
    queryFn: () => apiFetch<CitationEdgesResponse>(`/api/law/${lawId}/citations`),
    enabled: enabled && !!lawId,
    refetchInterval: (query) => {
      if (query.state.data?.status === "DONE") return false
      if (query.state.dataUpdateCount >= MAX_POLLS) return false
      return POLL_INTERVAL_MS
    },
  })
}
