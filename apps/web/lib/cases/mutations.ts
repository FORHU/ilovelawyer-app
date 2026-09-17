import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { caseKeys, chatKeys } from "@/lib/query-keys"
import {
  CONFIRM_BATCH_SIZE,
  chunk,
  mapPoolSettled,
  putFileToS3,
  resolveContentType,
  UPLOAD_CONCURRENCY,
} from "@/lib/cases/upload-batch"
import { terminalKeys } from "@/lib/terminal/mutations"
import type { CaseSnapshot } from "@/lib/terminal/types"

export interface Party {
  id: string
  name: string
  designation: string
}

/** The real shape `/api/my-cases` accepts/returns today. Type of Action and Jurisdiction are
 * not yet supported by the backend — see CONTEXT.md pending section. */
export type CaseStatus = "ACTIVE" | "ARCHIVED"

/** The real shape `/api/my-cases` accepts/returns today. Type of Action and Jurisdiction are
 * not yet supported by the backend — see CONTEXT.md pending section. */
export interface CaseRecord {
  id: string
  userId: string
  caseName: string
  parties: Party[]
  notes: string | null
  /** England and Wales / Scotland / Northern Ireland — UK-tenant-only. */
  ukJurisdiction?: string | null
  status: CaseStatus
  createdAt: string
  updatedAt: string
}

/** Lists the current user's cases, paginated (backend default: page 1, limit 20).
 * `search` is forwarded to the backend as a `search` query param so matching happens
 * across the user's full case set, not just the cases already fetched for this page.
 * `status` defaults to "ACTIVE" (matching the backend default) so every existing caller —
 * the calendar/transcription case-linking pickers and the Terminal landing page's case
 * switcher, none of which pass this param — automatically keeps excluding archived cases
 * without needing any change. Only Case Portfolio's own Archived tab passes "ARCHIVED". */
export function useCasesQuery(page = 1, limit = 20, search = "", status: CaseStatus = "ACTIVE") {
  return useQuery({
    queryKey: caseKeys.list({ page, limit, search, status }),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), status })
      if (search) params.set("search", search)
      return apiFetch<{ total: number; data: CaseRecord[] }>(`/api/my-cases?${params.toString()}`)
    },
  })
}

export function useCaseQuery(id: string) {
  return useQuery({
    queryKey: caseKeys.detail(id),
    queryFn: () => apiFetch<CaseRecord>(`/api/my-cases/${id}`),
    enabled: !!id,
  })
}

export interface CreateCasePayload {
  caseName: string
  partyInvolved?: string
  /** England and Wales / Scotland / Northern Ireland — UK-tenant-only, see Case.ukJurisdiction
   * on the backend. Distinct from the free-text court/venue `jurisdiction` field, which this
   * payload doesn't send yet (see CaseRecord above). */
  ukJurisdiction?: string
  notes?: string
}

export function useCreateCaseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCasePayload) =>
      apiFetch<CaseRecord>("/api/my-cases", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
    },
  })
}

export interface UpdateCasePayload {
  caseName?: string
  parties?: { name: string; designation: string }[]
  notes?: string
}

export function useUpdateCaseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCasePayload }) =>
      apiFetch<CaseRecord>(`/api/my-cases/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(updated.id) })
    },
  })
}

export function useDeleteCaseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // The API returns 204 No Content — parsing it as JSON (as apiFetch would) throws.
      await apiFetchRaw(`/api/my-cases/${id}`, { method: "DELETE" })
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
      queryClient.removeQueries({ queryKey: caseKeys.detail(id) })
    },
  })
}

// Archiving/unarchiving are independent of delete — a case in either status can still be
// deleted, and neither action blocks anything else on the case (documents, chat, etc. all keep
// working identically regardless of status). Both invalidate caseKeys.lists() broadly (same
// pattern as useUpdateCaseMutation/useDeleteCaseMutation above) so both the Active and Archived
// tab queries refetch — the case needs to disappear from one tab and appear in the other.
export function useArchiveCaseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<CaseRecord>(`/api/my-cases/${id}/archive`, { method: "POST" }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
      queryClient.setQueryData(caseKeys.detail(updated.id), updated)
    },
  })
}

export function useUnarchiveCaseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<CaseRecord>(`/api/my-cases/${id}/unarchive`, { method: "POST" }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
      queryClient.setQueryData(caseKeys.detail(updated.id), updated)
    },
  })
}

export interface UserDocument {
  id: string
  userId: string
  caseId: string | null
  name: string
  fileUrl: string | null
  s3Key?: string | null
  documentType?: string | null
  /** AI-assigned (Chat Wonder), free-form — distinct from the user-supplied `documentType`.
   * Null while extraction/categorization hasn't finished yet. */
  category?: string | null
  fileSize?: number | null
  mimeType?: string | null
  aiSummary: string | null
  /** Background text-extraction/embedding status for chat retrieval. */
  ragStatus: "PENDING" | "READY" | "FAILED"
  /** Lawyer-curated subset shown in the Case Brief export's Exhibit list — not every uploaded
   * document is an Exhibit just by being uploaded. Defaults false. */
  isExhibit: boolean
  createdAt: string
}

interface DocumentDataEntry {
  filename: string
  s3Key: string
  metaData: {
    documentType?: string
    fileSize: number
    mimeType: string
    /** Client-chosen (e.g. dropped into a folder) — when set, the backend skips its
     * chat-wonder auto-categorization call and uses this value as-is. */
    category?: string
  }
}

export interface BulkUploadResult {
  /** Documents the backend confirmed, in the same order as the input `files` minus any that
   * failed the presign/S3-PUT step (those never reach the confirm call at all). */
  confirmed: UserDocument[]
  /** Files whose presign, S3 PUT, or confirm call failed, with why. */
  failed: { file: File; reason: string }[]
  /** Parallel to `confirmed` — which input File each confirmed document came from. */
  succeededFiles: File[]
}

/** Uploads any number of files to a case. Presigns in batches of CONFIRM_BATCH_SIZE (one API
 * call per chunk, not one per file), PUTs to S3 with a small concurrency pool, then confirms
 * each chunk via POST /api/v1/my-cases/:caseId/documents. A single S3 or confirm failure
 * doesn't block other chunks or files in the same chunk. */
export function useUploadCaseDocumentsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      files,
      caseId,
      category,
    }: {
      files: File[]
      caseId: string
      /** Uploading straight into a folder card — see `DocumentDataEntry.metaData.category`. */
      category?: string
    }): Promise<BulkUploadResult> => {
      const confirmed: UserDocument[] = []
      const failed: { file: File; reason: string }[] = []
      const succeededFiles: File[] = []

      for (const fileChunk of chunk(files, CONFIRM_BATCH_SIZE)) {
        const contentTypes = fileChunk.map(resolveContentType)
        let items: { uploadUrl: string; key: string }[]
        try {
          const res = await apiFetch<{ items: { uploadUrl: string; key: string }[] }>(
            "/api/documents/presign",
            {
              method: "POST",
              body: JSON.stringify({
                files: fileChunk.map((file, i) => ({ filename: file.name, contentType: contentTypes[i] })),
                caseId,
              }),
            },
          )
          items = res.items
          if (!items || items.length !== fileChunk.length) throw new Error("Presign batch size mismatch")
        } catch (err) {
          const reason = err instanceof Error ? err.message : "Presign request failed"
          failed.push(...fileChunk.map((file) => ({ file, reason })))
          continue
        }

        const settled = await mapPoolSettled(fileChunk, UPLOAD_CONCURRENCY, async (file, i) => {
          const { uploadUrl, key } = items[i]!
          const contentType = contentTypes[i]!
          await putFileToS3(uploadUrl, file, contentType)
          return { file, key, contentType }
        })

        const succeeded = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
        settled.forEach((r, i) => {
          if (r.status === "rejected") {
            failed.push({ file: fileChunk[i]!, reason: r.reason instanceof Error ? r.reason.message : String(r.reason) })
          }
        })

        if (succeeded.length === 0) continue

        try {
          const documentData: DocumentDataEntry[] = succeeded.map(({ file, key, contentType }) => ({
            filename: file.name,
            s3Key: key,
            metaData: { fileSize: file.size, mimeType: contentType, ...(category ? { category } : {}) },
          }))

          const docs = await apiFetch<UserDocument[]>(`/api/my-cases/${caseId}/documents`, {
            method: "POST",
            body: JSON.stringify({ documentData }),
          })
          confirmed.push(...docs)
          succeededFiles.push(...succeeded.map(({ file }) => file))
        } catch (err) {
          const reason = err instanceof Error ? err.message : "Confirm request failed"
          failed.push(...succeeded.map(({ file }) => ({ file, reason })))
        }
      }

      return { confirmed, failed, succeededFiles }
    },
    onSuccess: ({ confirmed }, { caseId }) => {
      if (confirmed.length > 0) {
        queryClient.invalidateQueries({ queryKey: caseKeys.timeline(caseId) })
        // The Legal Terminal's Evidence & Timeline panel reads documents from the case snapshot
        // (useCaseSnapshotQuery), a separate query from this Workspace-owned list — without this,
        // a document uploaded from the Terminal panel itself wouldn't appear there until its own
        // idle poll eventually caught up (see AI_JOB_IDLE_POLL_MS's sibling on the snapshot query).
        queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
      }
    },
  })
}

/** Uploads any number of files without requiring a caseId — unlike
 * useUploadCaseDocumentsMutation, which is case-only. Presigns and confirms in batches of
 * CONFIRM_BATCH_SIZE; S3 PUTs run through a small concurrency pool. `consultationId` is sent
 * on both presign (S3 key scoping, ADR 0011) and confirm (DB link). */
export function useUploadDocumentsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      files,
      caseId,
      consultationId,
    }: {
      files: File[]
      caseId?: string
      consultationId?: string
    }): Promise<BulkUploadResult> => {
      const confirmed: UserDocument[] = []
      const failed: { file: File; reason: string }[] = []
      const succeededFiles: File[] = []

      for (const fileChunk of chunk(files, CONFIRM_BATCH_SIZE)) {
        const contentTypes = fileChunk.map(resolveContentType)
        let items: { uploadUrl: string; key: string }[]
        try {
          const res = await apiFetch<{ items: { uploadUrl: string; key: string }[] }>(
            "/api/documents/presign",
            {
              method: "POST",
              body: JSON.stringify({
                files: fileChunk.map((file, i) => ({ filename: file.name, contentType: contentTypes[i] })),
                caseId,
                consultationId,
              }),
            },
          )
          items = res.items
          if (!items || items.length !== fileChunk.length) throw new Error("Presign batch size mismatch")
        } catch (err) {
          const reason = err instanceof Error ? err.message : "Presign request failed"
          failed.push(...fileChunk.map((file) => ({ file, reason })))
          continue
        }

        const settled = await mapPoolSettled(fileChunk, UPLOAD_CONCURRENCY, async (file, i) => {
          const { uploadUrl, key } = items[i]!
          await putFileToS3(uploadUrl, file, contentTypes[i]!)
          return { file, key }
        })

        const succeeded = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
        settled.forEach((r, i) => {
          if (r.status === "rejected") {
            failed.push({ file: fileChunk[i]!, reason: r.reason instanceof Error ? r.reason.message : String(r.reason) })
          }
        })

        if (succeeded.length === 0) continue

        try {
          const docs = await apiFetch<UserDocument[]>("/api/documents", {
            method: "POST",
            body: JSON.stringify({
              items: succeeded.map(({ file, key }) => ({ key, name: file.name })),
              caseId,
              consultationId,
            }),
          })
          confirmed.push(...docs)
          succeededFiles.push(...succeeded.map(({ file }) => file))
        } catch (err) {
          const reason = err instanceof Error ? err.message : "Confirm request failed"
          failed.push(...succeeded.map(({ file }) => ({ file, reason })))
        }
      }

      return { confirmed, failed, succeededFiles }
    },
      // Splice the confirmed batch straight into the cache rather than forcing a refetch
      // right after the POST that already returned every document we'd get back from one.
    onSuccess: ({ confirmed }, { caseId, consultationId }) => {
      if (caseId && confirmed.length > 0) {
        queryClient.setQueryData<UserDocument[]>(caseKeys.timeline(caseId), (old) =>
          old ? [...confirmed, ...old] : old,
        )
      }
      if (consultationId && confirmed.length > 0) {
        queryClient.invalidateQueries({ queryKey: chatKeys.documents(consultationId) })
      }
    },
  })
}

function refetchWhileIndexing(query: { state: { data?: UserDocument[] } }) {
  return query.state.data?.some((doc) => doc.ragStatus === "PENDING") ? 4000 : false
}

/** Lists the documents attached to a case. Uploading (useUploadCaseDocumentMutation)
 * invalidates `caseKeys.timeline(caseId)`, so this refetches automatically afterward.
 * Polls while any row is PENDING so the indexing badge flips to ready without a reload. */
export function useCaseDocumentsQuery(caseId: string) {
  return useQuery({
    queryKey: caseKeys.timeline(caseId),
    queryFn: () => apiFetch<UserDocument[]>(`/api/documents?caseId=${caseId}`),
    enabled: !!caseId,
    refetchInterval: refetchWhileIndexing,
  })
}

export function useConsultationDocumentsQuery(consultationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.documents(consultationId ?? ""),
    queryFn: () => apiFetch<UserDocument[]>(`/api/documents?consultationId=${consultationId}`),
    enabled: !!consultationId,
    refetchInterval: refetchWhileIndexing,
  })
}

/** Toggles a Case Document's Mark-as-Exhibit flag — the only editable field on a document today.
 * PATCH /api/documents/:id is organization-scoped (no per-case access check), matching how
 * delete already works for this same endpoint family. */
export function useUpdateCaseDocumentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ documentId, isExhibit }: { documentId: string; caseId: string; isExhibit: boolean }) => {
      await apiFetchRaw(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ isExhibit }),
      })
    },
    onSuccess: (_data, { documentId, caseId, isExhibit }) => {
      queryClient.setQueryData<UserDocument[]>(caseKeys.timeline(caseId), (old) =>
        old ? old.map((d) => (d.id === documentId ? { ...d, isExhibit } : d)) : old,
      )
    },
  })
}

export function useDeleteCaseDocumentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string; caseId: string }) => {
      await apiFetchRaw(`/api/documents/${documentId}`, { method: "DELETE" })
    },
    onSuccess: (_data, { documentId, caseId }) => {
      // Filter the deleted id out of the cache in place rather than invalidating — same
      // reasoning as the upload mutations above: no need for a refetch to learn what we
      // already know just deleted successfully.
      queryClient.setQueryData<UserDocument[]>(caseKeys.timeline(caseId), (old) =>
        old ? old.filter((d) => d.id !== documentId) : old,
      )
      // Same patch applied to the Legal Terminal's case snapshot — see the matching comment on
      // useUploadCaseDocumentsMutation's onSuccess for why this second query needs it too.
      queryClient.setQueryData<CaseSnapshot>(terminalKeys.snapshot(caseId), (old) =>
        old ? { ...old, documents: old.documents.filter((d) => d.id !== documentId) } : old,
      )
    },
  })
}
