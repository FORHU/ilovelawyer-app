import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { citationMapKeys } from "@/lib/citation-map/mutations"
import { graphViewKeys } from "@/lib/graph-view/mutations"
import { getNotificationSocket } from "@/lib/notifications/socket"
import { useIsCaseRoomSubscribed } from "@/lib/cases/case-room"
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
  FindingTag,
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
  WitnessStatus,
  WorkspaceLayout,
} from "@/lib/terminal/types"

export const terminalKeys = {
  all: ["terminal"] as const,
  catalog: () => [...terminalKeys.all, "catalog"] as const,
  // Case-scoped: each case gets its own cached list. `workspacesAll` is the shared prefix, used
  // only for invalidating every case's cached list after a mutation (React Query's
  // invalidateQueries prefix-matches by default) since a create/update/delete doesn't otherwise
  // know which case's list is currently on screen.
  workspacesAll: () => [...terminalKeys.all, "workspaces"] as const,
  workspaces: (caseId: string) => [...terminalKeys.all, "workspaces", caseId] as const,
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
  caseBriefHistory: (caseId: string) =>
    [...terminalKeys.all, "case-brief-history", caseId] as const,
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
  | "timelineGenerate"
  | "witnessScoring"
  | "witnessExtract"

export interface AiJobStatus {
  status: "IN_PROGRESS" | "DONE" | "FAILED"
  startedAt: string
  finishedAt: string | null
  error: string | null
}

/** ai-job:started/done/failed payload — mirrors ilovelawyer-api's AiJobSocketPayload
 * (lib/socket.ts), pushed to case:<caseId> by AiGenerationLockSvc.begin()/finish(), the single
 * choke point every one of AiGenerationQueue's 8 kinds (including the auto-triggered
 * casePostExtraction, which resolves to the "caseRefresh" lock kind) funnels through. */
interface AiJobSocketPayload {
  caseId: string
  kind: AiGenerationKind
  status: AiJobStatus["status"]
  startedAt: string
  finishedAt: string | null
  error: string | null
}

const AI_JOB_SOCKET_EVENTS = ["ai-job:started", "ai-job:done", "ai-job:failed"] as const

/** Whether a Generate/Refresh/Scan action is currently running for this case, regardless of who
 * triggered it or when — a page refresh mid-generation otherwise looks idle even though the
 * server-side call is still going (see AiGenerationJob). Always enabled while mounted, not just
 * after a click, so a fresh page load immediately shows the real state. Invalidates the snapshot
 * query the moment status flips to DONE, so a viewer who didn't click Generate themselves (a
 * second tab, or one who refreshed mid-run) still sees the fresh content land without a manual
 * refresh — every current caller wants this, so it's built in rather than left as an opt-in
 * callback.
 *
 * No polling. One fetch on mount (staleTime 0 opts out of the app's 5-minute default — see
 * providers.tsx), then purely event-driven: ai-job:started/done/failed (AI_JOB_SOCKET_EVENTS,
 * pushed to case:<caseId> by AiGenerationLockSvc.begin()/finish(), see useCaseRoom) patches this
 * query's cache directly, on EVERY viewer of this case's Terminal — not just whoever clicked
 * Generate/Refresh. Two non-polling reconciliation paths cover what a poll used to catch:
 *   1. Below — a fresh refetch the moment this case's room join is confirmed, closing the gap
 *      between the initial fetch (which can race a job that started a moment earlier) and the
 *      socket actually being ready to receive events for it.
 *   2. useNotificationSocket's reconnect handler invalidates every mounted ai-job query — a
 *      dropped/reconnected socket, or a Next soft navigation that reuses this page without truly
 *      remounting it, refetches once on that event instead of on a timer. */
export function useAiJobStatus(caseId: string, kind: AiGenerationKind) {
  const queryClient = useQueryClient()
  const pushLive = useIsCaseRoomSubscribed(caseId)
  const query = useQuery({
    queryKey: terminalKeys.aiJob(caseId, kind),
    queryFn: () => apiFetch<AiJobStatus | null>(`/api/my-cases/${caseId}/ai-jobs/${kind}`),
    enabled: !!caseId,
    staleTime: 0,
  })

  const prevStatus = useRef(query.data?.status)
  useEffect(() => {
    if (prevStatus.current === "IN_PROGRESS" && query.data?.status === "DONE") {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
    }
    prevStatus.current = query.data?.status
  }, [query.data?.status, caseId, queryClient])

  const wasPushLive = useRef(pushLive)
  useEffect(() => {
    if (!wasPushLive.current && pushLive) {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, kind) })
    }
    wasPushLive.current = pushLive
  }, [pushLive, caseId, kind, queryClient])

  useEffect(() => {
    if (!caseId) return
    const socket = getNotificationSocket()

    const onEvent = (payload: AiJobSocketPayload) => {
      if (payload.caseId !== caseId || payload.kind !== kind) return
      queryClient.setQueryData<AiJobStatus>(terminalKeys.aiJob(caseId, kind), {
        status: payload.status,
        startedAt: payload.startedAt,
        finishedAt: payload.finishedAt,
        error: payload.error,
      })
    }

    AI_JOB_SOCKET_EVENTS.forEach((event) => socket.on(event, onEvent))
    return () => {
      AI_JOB_SOCKET_EVENTS.forEach((event) => socket.off(event, onEvent))
    }
  }, [caseId, kind, queryClient])

  return query
}

export function useTerminalCatalogQuery() {
  return useQuery({
    queryKey: terminalKeys.catalog(),
    queryFn: () => apiFetch<TerminalCatalog>("/api/terminal/catalog"),
  })
}

export function useTerminalWorkspacesQuery(caseId: string) {
  return useQuery({
    queryKey: terminalKeys.workspaces(caseId),
    queryFn: () => apiFetch<TerminalWorkspace[]>(`/api/terminal/workspaces?caseId=${caseId}`),
    enabled: !!caseId,
  })
}

// Backstop for the same reason as AI_JOB_IDLE_POLL_MS above: if this component also isn't
// truly remounting on the Workspace -> Terminal navigation, staleTime 0's mount-triggered
// refetch never fires, and there may be no live useAiJobStatus DONE-transition around either
// (the whole caseRefresh cycle can complete before the lawyer ever lands on the Terminal, so
// there's nothing to transition FROM). Long interval — this is the full case snapshot, not a
// cheap status ping — just enough to bound "how stale can this get while idle" instead of
// leaving it stale indefinitely.
const SNAPSHOT_IDLE_POLL_MS = 30_000

/** staleTime 0 for the same reason as useAiJobStatus above, and for a second one specific to
 * this query: a corpus change made from the Workspace (upload/delete) can trigger an automatic
 * caseRefresh entirely while the Terminal isn't mounted at all, so there's no live
 * useAiJobStatus DONE-transition around to invalidate this on the way back in either. Without
 * its own staleTime 0, landing on the Terminal after such a change would show the pre-change
 * snapshot for up to 5 minutes regardless of what useAiJobStatus does. */
export function useCaseSnapshotQuery(caseId: string) {
  return useQuery({
    queryKey: terminalKeys.snapshot(caseId),
    queryFn: () => apiFetch<CaseSnapshot>(`/api/my-cases/${caseId}/snapshot`),
    enabled: !!caseId,
    staleTime: 0,
    refetchInterval: SNAPSHOT_IDLE_POLL_MS,
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
      caseId: string
      name: string
      preset?: PresetValue
      layoutJson?: WorkspaceLayout
    }) =>
      apiFetch<TerminalWorkspace>("/api/terminal/workspaces", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.workspacesAll() })
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
      queryClient.invalidateQueries({ queryKey: terminalKeys.workspacesAll() })
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
      queryClient.invalidateQueries({ queryKey: terminalKeys.workspacesAll() })
    },
  })
}

export function useResetWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, preset }: { caseId: string; preset?: PresetValue }) =>
      apiFetch<TerminalWorkspace>("/api/terminal/workspaces/reset", {
        method: "POST",
        body: JSON.stringify(preset ? { caseId, preset } : { caseId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.workspacesAll() })
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
      queryClient.invalidateQueries({ queryKey: terminalKeys.workspacesAll() })
    },
  })
}

// No frontend caller left — auto-refresh (corpus-change triggered) replaced the lawyer-facing
// "Refresh analysis" button entirely. POST /api/my-cases/:caseId/refresh itself still exists
// server-side (CaseTerminalCtrl.refresh) as a deliberate ops/support escape hatch (curl-able
// directly), it's just no longer wrapped in a typed hook here since nothing in the UI calls it.

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
      documentId?: string
      pageNumber?: number
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

// Manual "Generate timeline" trigger — re-runs the same document-date extraction the automatic
// post-upload pipeline runs (queues/case-post-extraction.ts on the backend), for when a lawyer
// wants it re-derived without waiting for the next corpus change. Queued server-side
// (AiGenerationQueue/SQS), same pattern as useGenerateReconstructionMutation above: this POST
// returns once the job is claimed, not once the timeline is actually updated — the caller pairs
// this with useAiJobStatus(caseId, "timelineGenerate") and invalidates the timeline/graph-view
// queries itself once that flips to DONE, since useAiJobStatus only auto-invalidates the snapshot.
export function useGenerateTimelineMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/timeline/generate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "timelineGenerate") })
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

// Queued server-side (AiGenerationQueue/SQS) — a full-bundle scan can run for minutes. This POST
// returns once the job is claimed; ContradictionsPanel follows useAiJobStatus(caseId,
// "contradictions") and refreshes the graph view itself when that flips to DONE.
export function useScanContradictionsMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/evidence/contradictions/scan`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "contradictions") })
    },
  })
}

export type ContradictionStatus = "OPEN" | "RESOLVED" | "DISMISSED"

// A contradiction's triage status. The server carries it over to the same contradiction when a
// later scan finds it again (see EvidenceIntelligenceSvc.scanContradictionsInner).
export function useUpdateContradictionMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: ContradictionStatus; resolutionNote?: string | null }) =>
      apiFetch(`/api/my-cases/${caseId}/evidence/contradictions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
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
    mutationFn: (body: { category: FindingCategory; label: string; detail?: string | null; tag?: FindingTag | null }) =>
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

export function useUpdateFindingMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      label?: string
      detail?: string | null
      tag?: FindingTag | null
      position?: number | null
    }) =>
      apiFetch<CaseFinding>(`/api/my-cases/${caseId}/findings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

/** Jev's check of one saved finding, on request. Only Legal Issues has one so far; the API
 * answers 409 while USE_JEV_LEGAL_ISSUES is off. */
export function useJevCheckFindingMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CaseFinding>(`/api/my-cases/${caseId}/findings/${id}/jev-check`, { method: "POST" }),
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
      summary?: string
      status?: WitnessStatus
      credibility?: number
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

export function useUpdateWitnessMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      status?: WitnessStatus
      credibilityOverride?: number | null
      statementDueOn?: string | null
      statementReceived?: boolean
    }) =>
      apiFetch<Witness>(`/api/my-cases/${caseId}/witnesses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    },
  })
}

// Queued server-side (AiGenerationQueue/SQS): this POST returns once the job is claimed, not once
// scores are saved. The caller pairs it with useAiJobStatus(caseId, "witnessScoring") and
// refreshes the witnesses graph view itself when that flips to DONE.
export function useScoreWitnessesMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/witnesses/score`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.aiJob(caseId, "witnessScoring") })
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

// A dedicated action — narrative generation is a heavier, slower single-shot AI call the
// lawyer triggers deliberately, distinct from the automatic caseRefresh pipeline (findings/
// strategy/contradictions). Queued server-side (AiGenerationQueue / SQS): this POST returns
// once the job is claimed (AiJobStatus, IN_PROGRESS), not once the narrative is actually
// written, which is why invalidating the aiJob query (not the snapshot) here is what matters —
// useAiJobStatus is what invalidates the snapshot once the job actually flips to DONE.
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
// (AiGenerationQueue / SQS) — see useGenerateReconstructionMutation's comment above for why
// invalidating the aiJob query (not the snapshot) here is what matters.
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

export type CaseBriefFormat = "docx" | "pdf"

export interface CaseBriefExportResult {
  file: { id: string; fileUrl: string }
}

// Generates the Case Brief fresh from the live snapshot on every call — not cached, since the
// export is meant to reflect the case as it stands right now. Called with format=pdf for the
// inline preview, and separately with format=docx/pdf for the two download actions (see
// CaseBriefExportSvc on the backend). Every call — preview or download alike — is recorded
// server-side as a history entry; see useCaseBriefHistoryQuery below.
export function useExportCaseBriefMutation(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (format: CaseBriefFormat) =>
      apiFetch<CaseBriefExportResult>(`/api/my-cases/${caseId}/export?format=${format}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.caseBriefHistory(caseId) })
    },
  })
}

export interface CaseBriefHistoryEntry {
  id: string
  format: CaseBriefFormat
  createdAt: string
  file: { id: string; fileUrl: string | null }
}

interface CaseBriefHistoryPage {
  items: CaseBriefHistoryEntry[]
  nextCursor: string | null
}

const CASE_BRIEF_HISTORY_PAGE_SIZE = 20

/** Every past generation for this case (preview and download calls alike), most recent first —
 * so a lawyer can redownload something they made earlier instead of only ever having the latest
 * render. Each entry's fileUrl is re-presigned server-side on every fetch, since a URL minted at
 * generation time may have already expired.
 * Cursor-paginated, infinite-scroll style (not numbered pages) — same shape as
 * useInfiniteNotificationsQuery, but that one's own "view all" page drives loading via a manual
 * Load More button; this one's caller (CaseBriefHistory) triggers fetchNextPage from an
 * IntersectionObserver sentinel instead, since that's what was actually asked for here. `limit`
 * is always sent explicitly (never omitted) — the backend's nextCursor only gets computed when
 * the caller passes a limit, mirroring NotificationSvc.list's own contract. */
export function useCaseBriefHistoryQuery(caseId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: terminalKeys.caseBriefHistory(caseId),
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const params = new URLSearchParams({ limit: String(CASE_BRIEF_HISTORY_PAGE_SIZE) })
      if (pageParam) params.set("cursor", pageParam)
      return apiFetch<CaseBriefHistoryPage>(`/api/my-cases/${caseId}/export/history?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  })
}
