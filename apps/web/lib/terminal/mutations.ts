import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import type {
  CaseSnapshot,
  DeadlineRule,
  PresetValue,
  TerminalCatalog,
  TerminalWorkspace,
  WorkspaceLayout,
} from "@/lib/terminal/types"

export const terminalKeys = {
  all: ["terminal"] as const,
  catalog: () => [...terminalKeys.all, "catalog"] as const,
  workspaces: () => [...terminalKeys.all, "workspaces"] as const,
  snapshot: (caseId: string) => [...terminalKeys.all, "snapshot", caseId] as const,
  rules: () => [...terminalKeys.all, "procedure-rules"] as const,
}

export function useTerminalCatalogQuery() {
  return useQuery({
    queryKey: terminalKeys.catalog(),
    queryFn: () => apiFetch<TerminalCatalog>("/api/terminal/catalog"),
  })
}

export function useTerminalWorkspacesQuery() {
  return useQuery({
    queryKey: terminalKeys.workspaces(),
    queryFn: () => apiFetch<TerminalWorkspace[]>("/api/terminal/workspaces"),
  })
}

export function useCaseSnapshotQuery(caseId: string) {
  return useQuery({
    queryKey: terminalKeys.snapshot(caseId),
    queryFn: () => apiFetch<CaseSnapshot>(`/api/my-cases/${caseId}/snapshot`),
    enabled: !!caseId,
  })
}

export function useProcedureRulesQuery() {
  return useQuery({
    queryKey: terminalKeys.rules(),
    queryFn: () => apiFetch<DeadlineRule[]>("/api/terminal/procedure-rules"),
  })
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; preset?: PresetValue; layoutJson?: WorkspaceLayout }) =>
      apiFetch<TerminalWorkspace>("/api/terminal/workspaces", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.workspaces() })
    },
  })
}

export function useApplyWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<TerminalWorkspace>(`/api/terminal/workspaces/${id}/apply`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.workspaces() })
    },
  })
}

export function useResetWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (preset?: PresetValue) =>
      apiFetch<TerminalWorkspace>("/api/terminal/workspaces/reset", {
        method: "POST",
        body: JSON.stringify(preset ? { preset } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.workspaces() })
    },
  })
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetchRaw(`/api/terminal/workspaces/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.workspaces() })
    },
  })
}

export function useRefreshSnapshotMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<CaseSnapshot>(`/api/my-cases/${caseId}/refresh`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useCreateTimelineMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; occurredOn?: string }) =>
      apiFetch(`/api/my-cases/${caseId}/timeline`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useCreateRiskMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; severity: "FATAL" | "MAJOR" | "UNVERIFIED" | "MISSING_EVIDENCE" | "DEADLINE" }) =>
      apiFetch(`/api/my-cases/${caseId}/risks`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useScanContradictionsMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch(`/api/my-cases/${caseId}/evidence/contradictions/scan`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useCheckCitationMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { quotedText: string; officialText?: string }) =>
      apiFetch(`/api/my-cases/${caseId}/citations`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useCreateDeadlineMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { ruleCode: string; triggerDate: string }) =>
      apiFetch(`/api/my-cases/${caseId}/procedure/deadlines`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useCreateProcedureItemMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { kind: string; label: string }) =>
      apiFetch(`/api/my-cases/${caseId}/procedure/items`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useUpdateProcedureItemMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      apiFetch(`/api/my-cases/${caseId}/procedure/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ done }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useConfirmDeadlineMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deadlineId: string) =>
      apiFetch(`/api/my-cases/${caseId}/procedure/deadlines/${deadlineId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmed: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}
