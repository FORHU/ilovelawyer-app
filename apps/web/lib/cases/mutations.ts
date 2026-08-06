import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { caseKeys } from "@/lib/query-keys"

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
  parties?: { name: string; designation: string }[]
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
  aiSummary: string | null
  /** Background text-extraction/embedding status for chat retrieval — never surfaced as an
   * error to the user either way, so nothing in the UI needs to branch on this today. */
  ragStatus: "PENDING" | "READY" | "FAILED"
  createdAt: string
}

/** Uploads a file to the real document store: presigned S3 PUT, then a confirm call that
 * writes the DB row (POST /api/documents/presign -> PUT straight to S3 -> POST /api/documents).
 * `caseId` is forwarded to presign too (not just confirm) so the backend can build a
 * case-scoped S3 key — see ADR 0011. Re-enabled 2026-08-05 after confirming the backend's
 * `documents/users/{userId}/{timestamp}-{shortId}.ext` no-case fallback is live; re-test the
 * with-caseId path immediately after this change (it previously 400'd with `"caseId" is not
 * allowed` before this backend deploy — revert this if that recurs). */
export function useUploadCaseDocumentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, caseId }: { file: File; caseId?: string }) => {
      const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
        "/api/documents/presign",
        {
          method: "POST",
          body: JSON.stringify({ filename: file.name, contentType: file.type, caseId }),
        },
      )

      // Straight to S3 — not apiFetch, since this must not carry our API's bearer token
      // or same-origin credentials to a third-party (presigned) URL.
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!putRes.ok) throw new Error("Upload to storage failed")

      return apiFetch<UserDocument>("/api/documents", {
        method: "POST",
        body: JSON.stringify({ key, name: file.name, caseId }),
      })
    },
    onSuccess: (doc) => {
      if (doc.caseId) {
        queryClient.invalidateQueries({ queryKey: caseKeys.timeline(doc.caseId) })
      }
    },
  })
}

/** Lists the documents attached to a case. Uploading (useUploadCaseDocumentMutation)
 * invalidates `caseKeys.timeline(caseId)`, so this refetches automatically afterward. */
export function useCaseDocumentsQuery(caseId: string) {
  return useQuery({
    queryKey: caseKeys.timeline(caseId),
    queryFn: () => apiFetch<UserDocument[]>(`/api/documents?caseId=${caseId}`),
    enabled: !!caseId,
  })
}

export function useDeleteCaseDocumentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string; caseId: string }) => {
      await apiFetchRaw(`/api/documents/${documentId}`, { method: "DELETE" })
    },
    onSuccess: (_data, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.timeline(caseId) })
    },
  })
}
