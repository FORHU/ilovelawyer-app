import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import type { CreateCaseEdgePayload, GraphViewResponse, GraphViewType } from "./types"

export const graphViewKeys = {
  all: (caseId: string) => ["graph-view", caseId] as const,
  view: (caseId: string, viewType: GraphViewType) => [...graphViewKeys.all(caseId), viewType] as const,
}

/** One shared projection of CaseGraphNode/CaseEdge per view_type — Timeline/Witnesses/
 * Contradictions/Issues all read this instead of slicing the CaseSnapshot payload, so any
 * mutation that invalidates graphViewKeys.all(caseId) refreshes every mounted panel at once. */
export function useGraphViewQuery(caseId: string, viewType: GraphViewType) {
  return useQuery({
    queryKey: graphViewKeys.view(caseId, viewType),
    queryFn: () => apiFetch<GraphViewResponse>(`/api/my-cases/${caseId}/graph-view?view_type=${viewType}`),
    enabled: !!caseId,
  })
}

export function useCreateCaseEdgeMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCaseEdgePayload) =>
      apiFetch(`/api/my-cases/${caseId}/edges`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      // A prefix match — an edge can be relevant to more than one view_type, so every mounted
      // graph-view query for this case refetches, not just the one the mutating panel reads.
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

export function useDeleteCaseEdgeMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetchRaw(`/api/my-cases/${caseId}/edges/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}
