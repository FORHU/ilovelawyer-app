import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { citationMapKeys } from "@/lib/citation-map/mutations"
import { graphViewKeys } from "@/lib/graph-view/mutations"
import type {
  Annotation,
  AnnotationKind,
  AnnotationTargetType,
  CaseFinding,
  CaseReconstruction,
  CaseSnapshot,
  CaseTheory,
  DamageCategory,
  DamageClaim,
  DeadlineRule,
  DecisionRecord,
  FindingCategory,
  HearsayCategory,
  PresetValue,
  PrivilegeStatus,
  SnapshotCustodyEvent,
  SnapshotEvidenceMatrixItem,
  TerminalCatalog,
  TerminalWorkspace,
  TheoryDiff,
  TheoryStance,
  Witness,
  WorkspaceLayout,
} from "@/lib/terminal/types"

export const terminalKeys = {
  all: ["terminal"] as const,
  catalog: () => [...terminalKeys.all, "catalog"] as const,
  workspaces: () => [...terminalKeys.all, "workspaces"] as const,
  snapshot: (caseId: string) =>
    [...terminalKeys.all, "snapshot", caseId] as const,
  timeline: (caseId: string) =>
    [...terminalKeys.all, "timeline", caseId] as const,
  rules: () => [...terminalKeys.all, "procedure-rules"] as const,
  aiJob: (caseId: string, kind: AiGenerationKind) =>
    [...terminalKeys.all, "ai-job", caseId, kind] as const,
  theoryDiff: (caseId: string, theoryAId: string, theoryBId: string) =>
    [...terminalKeys.all, "theory-diff", caseId, ...[theoryAId, theoryBId].sort()] as const,
  annotations: (caseId: string, targetType: string, targetId: string) =>
    [...terminalKeys.all, "annotations", caseId, targetType, targetId] as const,
}

/** Mirrors ilovelawyer-api's AI_GENERATION_KINDS (src/constants/ai-generation-kinds.ts). */
export type AiGenerationKind =
  | "redTeam"
  | "caseReconstruction"
  | "caseRefresh"
  | "contradictions"
  | "caseStrategy"
  | "caseFinding"
  | "mindMap"
  | "audioOverviewScript"
  | "citationExpand"
  | "caseTheoryPropose"
  | "theoryDiff"
  | "caseReconstructionScenes"
  | "caseReconstructionTableRead"

export interface AiJobStatus {
  status: "IN_PROGRESS" | "DONE" | "FAILED"
  startedAt: string
  finishedAt: string | null
  error: string | null
}

const AI_JOB_POLL_MS = 3000

/** Polls whether a Generate/Refresh/Scan action is currently running for this case, regardless
 * of who triggered it or when — a page refresh mid-generation otherwise looks idle even though
 * the server-side call is still going (see AiGenerationJob). Always enabled while mounted, not
 * just after a click, so a fresh page load immediately shows the real state. Invalidates the
 * snapshot query the moment status flips to DONE, so a viewer who didn't click Generate
 * themselves (a second tab, or one who refreshed mid-run) still sees the fresh content land
 * without a manual refresh — every current caller wants this, so it's built in rather than left
 * as an opt-in callback. */
export function useAiJobStatus(caseId: string, kind: AiGenerationKind) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: terminalKeys.aiJob(caseId, kind),
    queryFn: () => apiFetch<AiJobStatus | null>(`/api/my-cases/${caseId}/ai-jobs/${kind}`),
    enabled: !!caseId,
    refetchInterval: (q) => (q.state.data?.status === "IN_PROGRESS" ? AI_JOB_POLL_MS : false),
  })

  const prevStatus = useRef(query.data?.status)
  useEffect(() => {
    if (prevStatus.current === "IN_PROGRESS" && query.data?.status === "DONE") {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    }
    prevStatus.current = query.data?.status
  }, [query.data?.status, caseId, queryClient])

  return query
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
    mutationFn: (body: {
      name: string
      preset?: PresetValue
      layoutJson?: WorkspaceLayout
    }) =>
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
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      name?: string
      preset?: PresetValue
      layoutJson?: WorkspaceLayout
    }) =>
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
      apiFetch<TerminalWorkspace>(`/api/terminal/workspaces/${id}/apply`, {
        method: "POST",
      }),
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

// Refresh is queued server-side (AiGenerationQueue / SQS) rather than run inline — this POST
// returns as soon as the job is claimed (AiGenerationJob, status IN_PROGRESS), not once the
// refresh has actually finished. Invalidating the aiJob query here (rather than waiting for its
// own next poll) is what makes useAiJobStatus's refetchInterval kick in immediately instead of
// only after its next incidental refetch; that hook is what invalidates the snapshot once the
// job flips to DONE, same as any other case-scoped Generate/Refresh action.
export function useRefreshSnapshotMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/refresh`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "caseRefresh") })
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
    queryFn: () =>
      apiFetch<CaseTimelineEvent[]>(`/api/my-cases/${caseId}/timeline`),
    enabled: !!caseId,
  })
}

export function useCreateTimelineMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      title: string
      occurredOn?: string
      description?: string
    }) =>
      apiFetch(`/api/my-cases/${caseId}/timeline`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      queryClient.invalidateQueries({ queryKey: terminalKeys.timeline(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

export function useUpdateTimelineMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, occurredOn }: { id: string; occurredOn: string }) =>
      apiFetch(`/api/my-cases/${caseId}/timeline/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ occurredOn }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      queryClient.invalidateQueries({ queryKey: terminalKeys.timeline(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

export function useCreateRiskMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      title: string
      severity:
        | "FATAL"
        | "MAJOR"
        | "UNVERIFIED"
        | "MISSING_EVIDENCE"
        | "DEADLINE"
    }) =>
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
    mutationFn: () =>
      apiFetch(`/api/my-cases/${caseId}/evidence/contradictions/scan`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

export interface UpdateEvidenceMatrixPayload {
  documentId: string
  authenticity?: string
  admissibility?: string
  probative?: string
  originalFile?: boolean
  needsVerify?: boolean
  notes?: string
  privilegeStatus?: PrivilegeStatus
  hearsayCategory?: HearsayCategory
  sponsoringWitnessId?: string | null
}

export function useUpdateEvidenceMatrixMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ documentId, ...body }: UpdateEvidenceMatrixPayload) =>
      apiFetch<SnapshotEvidenceMatrixItem>(
        `/api/my-cases/${caseId}/evidence/matrix/${documentId}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useAddCustodyEventMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      documentId,
      ...body
    }: {
      documentId: string
      custodianName: string
      action: string
      occurredAt: string
      notes?: string
    }) =>
      apiFetch<SnapshotCustodyEvent>(
        `/api/my-cases/${caseId}/evidence/matrix/${documentId}/custody`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useDeleteCustodyEventMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      documentId,
      eventId,
    }: {
      documentId: string
      eventId: string
    }) => {
      await apiFetchRaw(
        `/api/my-cases/${caseId}/evidence/matrix/${documentId}/custody/${eventId}`,
        {
          method: "DELETE",
        }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useCheckCitationMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { quotedText: string; citedReference?: string; officialText?: string; pinpoint?: string }) =>
      apiFetch(`/api/my-cases/${caseId}/citations`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      // Citation Map's seed is built from citedReference — a fresh check should show up there
      // without the user having to manually refresh that panel.
      queryClient.invalidateQueries({ queryKey: citationMapKeys.seed(caseId) })
    },
  })
}

export function useCreateDeadlineMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      ruleCode: string
      triggerDate: string
      sourceTimelineEventId?: string
    }) =>
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
      apiFetch(
        `/api/my-cases/${caseId}/procedure/deadlines/${deadlineId}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ confirmed: true }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useRecomputeDeadlineMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deadlineId: string) =>
      apiFetch(
        `/api/my-cases/${caseId}/procedure/deadlines/${deadlineId}/recompute`,
        {
          method: "POST",
        }
      ),
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
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

export function useDeleteFindingMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetchRaw(`/api/my-cases/${caseId}/findings/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

export function useCreateWitnessMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      role?: string
      contact?: string
      notes?: string
    }) =>
      apiFetch<Witness>(`/api/my-cases/${caseId}/witnesses`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

export function useDeleteWitnessMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetchRaw(`/api/my-cases/${caseId}/witnesses/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

export function useCreateDamageMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      category: DamageCategory
      description?: string
      amount?: number
    }) =>
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
      await apiFetchRaw(`/api/my-cases/${caseId}/damages/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

// A dedicated action (not part of useRefreshSnapshotMutation) — narrative generation is a
// heavier, slower single-shot AI call the lawyer triggers deliberately. Queued server-side
// (AiGenerationQueue / SQS): this POST returns once the job is claimed (AiJobStatus,
// IN_PROGRESS), not once the narrative is actually written — see useRefreshSnapshotMutation's
// comment for why invalidating the aiJob query (not the snapshot) here is what matters.
// CaseReconstructionPanel resyncs its edit drafts off the job's IN_PROGRESS -> DONE transition
// rather than off this mutation's return value, since that value is no longer the finished row.
export function useGenerateReconstructionMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<AiJobStatus>(
        `/api/my-cases/${caseId}/reconstruction/generate`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "caseReconstruction") })
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

// Grounded Reconstruction Rung 1 (differentiation program, Phase 3) — a scene-by-scene break
// of the case's most consequential episode, built from the timeline + evidence, each element
// individually sourced. Queued the same way as useGenerateReconstructionMutation above.
export function useGenerateReconstructionScenesMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/reconstruction/scenes`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "caseReconstructionScenes") })
    },
  })
}

// Rung 2 — multi-voice audio rendered from the scene script (one Polly voice per actor, a
// narrator for action lines). Requires scenes to exist first; the backend 422s otherwise.
export function useGenerateTableReadMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/reconstruction/table-read`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "caseReconstructionTableRead") })
    },
  })
}

// Audio narrates the General register only (see CaseReconstructionAudioSvc on the backend) —
// this kicks off an async Polly job; the panel itself owns the poll loop while it's mounted.
export function useGenerateReconstructionAudioMutation(caseId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ jobName: string; status: string }>(
        `/api/my-cases/${caseId}/reconstruction/audio`,
        { method: "POST" }
      ),
  })
}

export interface ReconstructionAudioPollResult {
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED"
  audioFile?: { id: string; fileUrl: string | null }
  failureReason?: string
}

export function pollReconstructionAudio(caseId: string) {
  return apiFetch<ReconstructionAudioPollResult>(
    `/api/my-cases/${caseId}/reconstruction/audio/poll`
  )
}

// Attacks the case's own structured findings (Legal Issues, Weaknesses, Contradictions,
// Witnesses, Damages) rather than raw documents — see RedTeamSvc.generate on the backend.
// No manual-edit counterpart to useUpdateReconstructionMutation: this is opposing counsel's
// own commentary, not something the lawyer rewrites in their own voice. Queued server-side
// (AiGenerationQueue / SQS) — see useRefreshSnapshotMutation's comment for why invalidating
// the aiJob query (not the snapshot) here is what matters.
export function useGenerateRedTeamMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/red-team/generate`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "redTeam") })
    },
  })
}

// ── Case Theories (differentiation program, Phase 2) ──────────────────────────────────────
// Theories/claims/assumptions/openQuestions themselves come straight off the case snapshot
// (snapshot.theories), the same way findings/witnesses/damages do — no separate list query.

export function useCreateTheoryMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; thesis: string }) =>
      apiFetch<CaseTheory>(`/api/my-cases/${caseId}/theories`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useUpdateTheoryMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; thesis?: string }) =>
      apiFetch<CaseTheory>(`/api/my-cases/${caseId}/theories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

function useTheoryLifecycleMutation(caseId: string, action: "publish" | "retire" | "fork") {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CaseTheory>(`/api/my-cases/${caseId}/theories/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export const usePublishTheoryMutation = (caseId: string) => useTheoryLifecycleMutation(caseId, "publish")
export const useRetireTheoryMutation = (caseId: string) => useTheoryLifecycleMutation(caseId, "retire")
// Copies an AI-proposed (or another lawyer's) theory into a new DRAFT owned by the caller —
// the only way to turn it into something editable/publishable (CaseTheorySvc.fork).
export const useForkTheoryMutation = (caseId: string) => useTheoryLifecycleMutation(caseId, "fork")

export function useAddTheoryClaimMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ theoryId, ...body }: { theoryId: string; statement: string; stance: TheoryStance; graphNodeId?: string }) =>
      apiFetch(`/api/my-cases/${caseId}/theories/${theoryId}/claims`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useAddTheoryAssumptionMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ theoryId, statement }: { theoryId: string; statement: string }) =>
      apiFetch(`/api/my-cases/${caseId}/theories/${theoryId}/assumptions`, { method: "POST", body: JSON.stringify({ statement }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useAddTheoryOpenQuestionMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ theoryId, question }: { theoryId: string; question: string }) =>
      apiFetch(`/api/my-cases/${caseId}/theories/${theoryId}/open-questions`, { method: "POST", body: JSON.stringify({ question }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

// Queued server-side (AiGenerationQueue/SQS), same as useGenerateRedTeamMutation — seeds a
// DRAFT theory (authorUserId: null) from the case's own findings/strategy.
export function useProposeTheoryMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/theories/propose`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "caseTheoryPropose") })
    },
  })
}

/** Cached reconciler output for one pair of theories — `null` while no diff has been generated
 * yet for that pair (or the pair supplied is empty). Not part of the case snapshot: a diff is
 * generated per pair on demand, not eagerly for every combination. */
export function useTheoryDiffQuery(caseId: string, theoryAId: string, theoryBId: string) {
  return useQuery({
    queryKey: terminalKeys.theoryDiff(caseId, theoryAId, theoryBId),
    queryFn: () =>
      apiFetch<TheoryDiff | null>(
        `/api/my-cases/${caseId}/theories/diff?theoryAId=${theoryAId}&theoryBId=${theoryBId}`,
      ),
    enabled: !!caseId && !!theoryAId && !!theoryBId && theoryAId !== theoryBId,
  })
}

// Queued server-side, same pattern as useProposeTheoryMutation — the caller is responsible for
// invalidating terminalKeys.theoryDiff once useAiJobStatus(caseId, "theoryDiff") flips to DONE
// (see TheoriesPanel), since which pair just finished isn't encoded in the job status itself.
export function useGenerateTheoryDiffMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { theoryAId: string; theoryBId: string }) =>
      apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/theories/diff`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "theoryDiff") })
    },
  })
}

// ── Annotations (differentiation program, Phase 2) ────────────────────────────────────────
// Comments/disputes/alternative-readings on any case element — a decision, a graph node, an
// edge, a document chunk. Scoped per-target (not read off the snapshot, unlike theories) since
// most targets have many annotations and a panel only ever needs the ones for what it's showing.

export function useAnnotationsQuery(caseId: string, targetType: AnnotationTargetType, targetId: string) {
  return useQuery({
    queryKey: terminalKeys.annotations(caseId, targetType, targetId),
    queryFn: () =>
      apiFetch<Annotation[]>(`/api/my-cases/${caseId}/annotations?targetType=${targetType}&targetId=${targetId}`),
    enabled: !!caseId && !!targetId,
  })
}

export function useCreateAnnotationMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { targetType: AnnotationTargetType; targetId: string; kind?: AnnotationKind; body: string }) =>
      apiFetch<Annotation>(`/api/my-cases/${caseId}/annotations`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.annotations(caseId, variables.targetType, variables.targetId) })
    },
  })
}

function useAnnotationStatusMutation(caseId: string, action: "resolve" | "reopen") {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; targetType: AnnotationTargetType; targetId: string }) =>
      apiFetch<Annotation>(`/api/my-cases/${caseId}/annotations/${id}/${action}`, { method: "POST" }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.annotations(caseId, variables.targetType, variables.targetId) })
    },
  })
}

export const useResolveAnnotationMutation = (caseId: string) => useAnnotationStatusMutation(caseId, "resolve")
export const useReopenAnnotationMutation = (caseId: string) => useAnnotationStatusMutation(caseId, "reopen")

// Decision Records are never generated on demand (see useGenerateRedTeamMutation above for the
// contrast) — they're produced automatically per legal chat turn. A lawyer can only dispute one
// (register disagreement, keep the record) or reactivate it; editing/reassigning authorship isn't
// offered, matching how CaseFinding's AI-authored rows are handled elsewhere in this file.
export function useDisputeDecisionMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiFetch<DecisionRecord>(`/api/my-cases/${caseId}/decisions/${id}/dispute`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}

export function useReactivateDecisionMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiFetch<DecisionRecord>(`/api/my-cases/${caseId}/decisions/${id}/reactivate`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    },
  })
}
