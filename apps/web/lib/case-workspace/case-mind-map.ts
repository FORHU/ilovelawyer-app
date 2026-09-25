import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetch";
import { caseKeys } from "@/lib/query-keys";
import { terminalKeys, useAiJobStatus, type AiJobStatus } from "@/lib/terminal/mutations";
import { usableMindMap, type MindMapItem } from "@/lib/chat/mind-map-parser";
import type { MindMapChangeResult } from "@/lib/chat/mutations";

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
}

/**
 * The case map plus the state of its build job (AI job kind "caseMindMap" — held by both the
 * automatic post-upload build and Studio's Regenerate). Refetches the map when a build finishes,
 * wherever it was started.
 */
export function useCaseMindMap(caseId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: caseKeys.mindMap(caseId),
    queryFn: () => apiFetch<CaseMindMap | null>(`/api/my-cases/${caseId}/mind-map`),
    enabled: !!caseId,
  });
  const job = useAiJobStatus(caseId, "caseMindMap");

  const prevStatus = useRef(job.data?.status);
  useEffect(() => {
    if (prevStatus.current === "IN_PROGRESS" && job.data?.status && job.data.status !== "IN_PROGRESS") {
      void queryClient.invalidateQueries({ queryKey: caseKeys.mindMap(caseId) });
    }
    prevStatus.current = job.data?.status;
  }, [job.data?.status, caseId, queryClient]);

  return {
    map: query.data ?? null,
    /** The tree, only when it has at least one branch — same render gate as a chat map. */
    tree: usableMindMap(query.data?.data),
    isLoading: query.isLoading,
    isBuilding: job.data?.status === "IN_PROGRESS",
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
