import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import type {
  CaseFinding,
  CaseReconstruction,
  CaseSnapshot,
  DamageCategory,
  DamageClaim,
  DeadlineRule,
  FindingCategory,
  PresetValue,
  RedTeamAssessment,
  TerminalCatalog,
  TerminalWorkspace,
  Witness,
  WorkspaceLayout,
} from "@/lib/terminal/types"

export const terminalKeys = {
  all: ["terminal"] as const,
  catalog: () => [...terminalKeys.all, "catalog"] as const,
  workspaces: () => [...terminalKeys.all, "workspaces"] as const,
  snapshot: (caseId: string) => [...terminalKeys.all, "snapshot", caseId] as const,
  timeline: (caseId: string) => [...terminalKeys.all, "timeline", caseId] as const,
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

// Updates an existing workspace's layout in place — distinct from useCreateWorkspaceMutation,
// which always makes a new named row. Backend already supports this (PATCH .../:id).
export function useUpdateWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; preset?: PresetValue; layoutJson?: WorkspaceLayout }) =>
      apiFetch<TerminalWorkspace>(`/api/terminal/workspaces/${id}`, {
        method: "PATCH",
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

export interface CaseTimelineEvent {
  id: string
  caseId: string
  title: string
  occurredOn: string | null
  description: string | null
  status: string
  source: "AI" | "LAWYER" | "CALENDAR"
}

export function useCaseTimelineQuery(caseId: string) {
  return useQuery({
    queryKey: terminalKeys.timeline(caseId),
    queryFn: () => apiFetch<CaseTimelineEvent[]>(`/api/my-cases/${caseId}/timeline`),
    enabled: !!caseId,
  })
}

export function useCreateTimelineMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; occurredOn?: string; description?: string }) =>
      apiFetch(`/api/my-cases/${caseId}/timeline`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      queryClient.invalidateQueries({ queryKey: terminalKeys.timeline(caseId) })
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

// Backs five Terminal panels (Legal Issues / Weaknesses / Strengths / Attack Strategies /
// Defense Strategies) — one CaseFinding table filtered by category, same as the backend.
export function useCreateFindingMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { category: FindingCategory; label: string }) =>
      apiFetch<CaseFinding>(`/api/my-cases/${caseId}/findings`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useDeleteFindingMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetchRaw(`/api/my-cases/${caseId}/findings/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useCreateWitnessMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; role?: string; contact?: string; notes?: string }) =>
      apiFetch<Witness>(`/api/my-cases/${caseId}/witnesses`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useDeleteWitnessMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetchRaw(`/api/my-cases/${caseId}/witnesses/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useCreateDamageMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { category: DamageCategory; description?: string; amount?: number }) =>
      apiFetch<DamageClaim>(`/api/my-cases/${caseId}/damages`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useDeleteDamageMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetchRaw(`/api/my-cases/${caseId}/damages/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

// A dedicated action (not part of useRefreshSnapshotMutation) — narrative generation is a
// heavier, slower single-shot AI call the lawyer triggers deliberately.
export function useGenerateReconstructionMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<CaseReconstruction>(`/api/my-cases/${caseId}/reconstruction/generate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export interface UpdateReconstructionPayload {
  narrative?: string
  narrativeCourt?: string
  narrativeOpposing?: string
}

// Any of the three registers can be edited independently — the backend only marks audio
// stale when `narrative` (the General register audio is synthesized from) is the one that
// changed, so editing Court/Opposing text alone leaves existing audio untouched.
export function useUpdateReconstructionMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateReconstructionPayload) =>
      apiFetch<CaseReconstruction>(`/api/my-cases/${caseId}/reconstruction`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

// Audio narrates the General register only (see CaseReconstructionAudioSvc on the backend) —
// this kicks off an async Polly job; the panel itself owns the poll loop while it's mounted.
export function useGenerateReconstructionAudioMutation(caseId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ jobName: string; status: string }>(`/api/my-cases/${caseId}/reconstruction/audio`, { method: "POST" }),
  })
}

export interface ReconstructionAudioPollResult {
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED"
  audioFile?: { id: string; fileUrl: string | null }
  failureReason?: string
}

export function pollReconstructionAudio(caseId: string) {
  return apiFetch<ReconstructionAudioPollResult>(`/api/my-cases/${caseId}/reconstruction/audio/poll`)
}

// Attacks the case's own structured findings (Legal Issues, Weaknesses, Contradictions,
// Witnesses, Damages) rather than raw documents — see RedTeamSvc.generate on the backend.
// No manual-edit counterpart to useUpdateReconstructionMutation: this is opposing counsel's
// own commentary, not something the lawyer rewrites in their own voice.
export function useGenerateRedTeamMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<RedTeamAssessment>(`/api/my-cases/${caseId}/red-team/generate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}
