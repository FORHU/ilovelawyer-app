import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetch";
import { caseKeys } from "@/lib/query-keys";
import { terminalKeys, useAiJobStatus, type AiJobStatus } from "@/lib/terminal/mutations";
import { useCaseDocumentsQuery } from "@/lib/cases/mutations";
import { refreshWillReplaceCaseMap } from "./case-mind-map-status";
import { usableMindMap, type MindMapItem } from "@/lib/chat/mind-map-parser";
import type { MindMapChangeResult } from "@/lib/chat/mutations";
import type { MindMapEditRequest } from "@/components/chat/mind-map/types";

/** The case's mind map built from its uploaded documents (ilovelawyer-api's CaseMindMapSvc) —
 * rebuilt by the post-upload refresh the same way the timeline's key dates are, and what Studio's
 * Mind Map panel shows first. Separate from the per-consultation maps chat turns produce. */
export interface CaseMindMap {
  id: string;
  caseId: string;
  data: MindMapItem;
  /** 1 = first build; every build, expand and undo moves it. */
  version: number;
  generatedAt: string;
  /** READY documents it was built from. */
  documentCount: number;
  /** Expands/edits since the last build — what a Regenerate would replace. */
  expandedCount: number;
  /** Set when every document it was built from was removed or archived: hidden until the next
   * build (see `tree` below). */
  retiredAt?: string | null;
}

/** Refetches the case map when `status` leaves IN_PROGRESS. */
function useRefetchMapWhenDone(caseId: string, status: string | undefined) {
  const queryClient = useQueryClient();
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "IN_PROGRESS" && status && status !== "IN_PROGRESS") {
      void queryClient.invalidateQueries({ queryKey: caseKeys.mindMap(caseId) });
    }
    prevStatus.current = status;
  }, [status, caseId, queryClient]);
}

/**
 * The case map plus the state of its build job (AI job kind "caseMindMap" — held by both the
 * automatic build and Studio's Regenerate). Refetches the map when a build finishes, wherever it
 * was started, and when an Analysis Refresh (job "caseRefresh") finishes.
 *
 * An Analysis Refresh rebuilds the map only as its last step, but a map it is going to replace
 * shows as regenerating for the whole run (`isRegenerating`), like the Timeline does. It won't
 * replace a map the lawyer has expanded or edited (CaseMindMapSvc leaves those alone), so those
 * don't spin; and with no live map it only builds one when the case has indexed documents. Can
 * spin for nothing in two rare cases the app can't see (the run's map step finds its documents
 * unchanged, or automatic builds are off on the server); the map then just refetches unchanged.
 */
export function useCaseMindMap(caseId: string) {
  const query = useQuery({
    queryKey: caseKeys.mindMap(caseId),
    queryFn: () => apiFetch<CaseMindMap | null>(`/api/my-cases/${caseId}/mind-map`),
    enabled: !!caseId,
  });
  const job = useAiJobStatus(caseId, "caseMindMap");
  const refreshJob = useAiJobStatus(caseId, "caseRefresh");
  const documents = useCaseDocumentsQuery(caseId);
  useRefetchMapWhenDone(caseId, job.data?.status);
  useRefetchMapWhenDone(caseId, refreshJob.data?.status);

  const map = query.data ?? null;
  const isBuilding = job.data?.status === "IN_PROGRESS";
  const isRefreshing = refreshJob.data?.status === "IN_PROGRESS";
  const refreshWillReplace = refreshWillReplaceCaseMap({
    isRefreshing,
    map,
    hasIndexedDocuments: (documents.data ?? []).some((doc) => doc.ragStatus === "READY" && doc.status !== "ARCHIVED"),
  });

  return {
    map: query.data ?? null,
    /** The tree, only when it has at least one branch — same render gate as a chat map — and the
     * map isn't retired. */
    tree: query.data?.retiredAt ? undefined : usableMindMap(query.data?.data),
    /** True when the case had a map but its documents were all removed or archived. */
    retired: Boolean(query.data?.retiredAt),
    isLoading: query.isLoading,
    /** The map's own build is running. Blocks expand/edit/undo, whose result it would replace. */
    isBuilding,
    /** An Analysis Refresh is running that will end by replacing this map (see above). */
    refreshWillReplace,
    /** What the Regenerate icon and "building" states show: the map's own build, or an Analysis
     * Refresh that's going to replace it. */
    isRegenerating: isBuilding || refreshWillReplace,
    buildFailed: job.data?.status === "FAILED",
  };
}

/** Studio's Regenerate on the case map — queued on the API; progress arrives through the
 * "caseMindMap" AI job that useCaseMindMap already watches. */
export function useGenerateCaseMindMapMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<AiJobStatus>(`/api/my-cases/${caseId}/mind-map/generate`, { method: "POST" }),
    onSuccess: (status) => {
      queryClient.setQueryData(terminalKeys.aiJob(caseId, "caseMindMap"), status);
    },
  });
}

export function expandCaseMindMapNode(caseId: string, body: { nodeId: string; count?: number }) {
  return apiFetch<MindMapChangeResult>(`/api/my-cases/${caseId}/mind-map/expand`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function editCaseMindMapNode(caseId: string, body: MindMapEditRequest) {
  return apiFetch<MindMapChangeResult>(`/api/my-cases/${caseId}/mind-map`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function revertCaseMindMap(caseId: string, body: { version?: number }) {
  return apiFetch<MindMapChangeResult>(`/api/my-cases/${caseId}/mind-map/revert`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Writes an expand/undo result into the cached case map so the canvas updates immediately. */
export function applyCaseMindMapChange(queryClient: QueryClient, caseId: string, result: MindMapChangeResult) {
  queryClient.setQueryData<CaseMindMap | null>(caseKeys.mindMap(caseId), (map) =>
    // expandedCount catches up on the refetch the caller also triggers.
    map ? { ...map, data: result.mindMap, version: result.version } : map,
  );
}
