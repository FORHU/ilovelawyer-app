import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { caseKeys, chatKeys } from "@/lib/query-keys"
import { CONFIRM_BATCH_SIZE, chunk, mapPoolSettled, putFileToS3, UPLOAD_CONCURRENCY } from "@/lib/cases/upload-batch"

export interface Party {
  id: string
  name: string
  designation: string
}

/** The real shape `/api/my-cases` accepts/returns today. Type of Action and Jurisdiction are
 * not yet supported by the backend — see CONTEXT.md pending section. */
export interface CaseRecord {
  id: string
  userId: string
  caseName: string
  parties: Party[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** Lists the current user's cases, paginated (backend default: page 1, limit 20).
 * `search` is forwarded to the backend as a `search` query param so matching happens
 * across the user's full case set, not just the cases already fetched for this page. */
export function useCasesQuery(page = 1, limit = 20, search = "") {
  return useQuery({
    queryKey: caseKeys.list({ page, limit, search }),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
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

export interface UserDocument {
  id: string
  userId: string
  caseId: string | null
  name: string
  fileUrl: string | null
  s3Key?: string | null
  documentType?: string | null
  fileSize?: number | null
  mimeType?: string | null
  aiSummary: string | null
  /** Background text-extraction/embedding status for chat retrieval. */
  ragStatus: "PENDING" | "READY" | "FAILED"
  createdAt: string
}

/** Uploads a file to the real document store: presigned S3 PUT, then a confirm call that
 * writes the DB row (POST /api/documents/presign -> PUT straight to S3 -> POST /api/documents).
 * `caseId` is forwarded to presign too (not just confirm) so the backend can build a
 * case-scoped S3 key — see ADR 0011. Re-enabled 2026-08-05 after confirming the backend's
 * `documents/users/{userId}/{timestamp}-{shortId}.ext` no-case fallback is live; re-test the
 * with-caseId path immediately after this change (it previously 400'd with `"caseId" is not
 * allowed` before this backend deploy — revert this if that recurs).
 * `consultationId` (a not-yet-cased consultation) is a fallback scope for presign only — same
 * idea as `caseId`, so a consultation's attachments land under documents/consultations/{id}/
 * instead of the generic per-user bucket. Ignored by the backend whenever `caseId` is present. */
export function useUploadCaseDocumentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, caseId, consultationId }: { file: File; caseId?: string; consultationId?: string }) => {
      const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
        "/api/documents/presign",
        {
          method: "POST",
          body: JSON.stringify({ filename: file.name, contentType: file.type, caseId, consultationId }),
        },
      )

      await putFileToS3(uploadUrl, file)

      return apiFetch<UserDocument>("/api/documents", {
        method: "POST",
        body: JSON.stringify({ key, name: file.name, caseId }),
      })
    },
    onSuccess: (doc) => {
      // Splice straight into the cached list instead of invalidating — invalidating here
      // would force a second GET /api/documents?caseId= round trip immediately after the
      // POST that already told us everything about the new document.
      if (doc.caseId) {
        queryClient.setQueryData<UserDocument[]>(caseKeys.timeline(doc.caseId), (old) =>
          old ? [doc, ...old] : old,
        )
      }
    },
  })
}

interface DocumentDataEntry {
  filename: string
  s3Key: string
  metaData: {
    documentType?: string
    fileSize: number
    mimeType: string
  }
}

export interface BulkUploadResult {
  /** Documents the backend confirmed, in the same order as the input `files` minus any that
   * failed the presign/S3-PUT step (those never reach the confirm call at all). */
  confirmed: UserDocument[]
  /** Files whose presign, S3 PUT, or confirm call failed. */
  failed: File[]
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
    mutationFn: async ({ files, caseId }: { files: File[]; caseId: string }): Promise<BulkUploadResult> => {
      const confirmed: UserDocument[] = []
      const failed: File[] = []
      const succeededFiles: File[] = []

      for (const fileChunk of chunk(files, CONFIRM_BATCH_SIZE)) {
        let items: { uploadUrl: string; key: string }[]
        try {
          const res = await apiFetch<{ items: { uploadUrl: string; key: string }[] }>(
            "/api/documents/presign",
            {
              method: "POST",
              body: JSON.stringify({
                files: fileChunk.map((file) => ({ filename: file.name, contentType: file.type })),
                caseId,
              }),
            },
          )
          items = res.items
          if (!items || items.length !== fileChunk.length) throw new Error("Presign batch size mismatch")
        } catch {
          failed.push(...fileChunk)
          continue
        }

        const settled = await mapPoolSettled(fileChunk, UPLOAD_CONCURRENCY, async (file, i) => {
          const { uploadUrl, key } = items[i]!
          await putFileToS3(uploadUrl, file)
          return { file, key }
        })

        const succeeded = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
        settled.forEach((r, i) => {
          if (r.status === "rejected") failed.push(fileChunk[i]!)
        })

        if (succeeded.length === 0) continue

        try {
          const documentData: DocumentDataEntry[] = succeeded.map(({ file, key }) => ({
            filename: file.name,
            s3Key: key,
            metaData: { fileSize: file.size, mimeType: file.type },
          }))

          const docs = await apiFetch<UserDocument[]>(`/api/my-cases/${caseId}/documents`, {
            method: "POST",
            body: JSON.stringify({ documentData }),
          })
          confirmed.push(...docs)
          succeededFiles.push(...succeeded.map(({ file }) => file))
        } catch {
          failed.push(...succeeded.map(({ file }) => file))
        }
      }

      return { confirmed, failed, succeededFiles }
    },
    onSuccess: ({ confirmed }, { caseId }) => {
      if (confirmed.length > 0) {
        queryClient.invalidateQueries({ queryKey: caseKeys.timeline(caseId) })
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
      const failed: File[] = []
      const succeededFiles: File[] = []

      for (const fileChunk of chunk(files, CONFIRM_BATCH_SIZE)) {
        let items: { uploadUrl: string; key: string }[]
        try {
          const res = await apiFetch<{ items: { uploadUrl: string; key: string }[] }>(
            "/api/documents/presign",
            {
              method: "POST",
              body: JSON.stringify({
                files: fileChunk.map((file) => ({ filename: file.name, contentType: file.type })),
                caseId,
                consultationId,
              }),
            },
          )
          items = res.items
          if (!items || items.length !== fileChunk.length) throw new Error("Presign batch size mismatch")
        } catch {
          failed.push(...fileChunk)
          continue
        }

        const settled = await mapPoolSettled(fileChunk, UPLOAD_CONCURRENCY, async (file, i) => {
          const { uploadUrl, key } = items[i]!
          await putFileToS3(uploadUrl, file)
          return { file, key }
        })

        const succeeded = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
        settled.forEach((r, i) => {
          if (r.status === "rejected") failed.push(fileChunk[i]!)
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
        } catch {
          failed.push(...succeeded.map(({ file }) => file))
        }
      }

      return { confirmed, failed, succeededFiles }
    },
      // Same reasoning as useUploadCaseDocumentMutation above: splice the confirmed batch
      // straight into the cache rather than forcing a refetch right after the POST that
      // already returned every document we'd get back from one.
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
    },
  })
}
