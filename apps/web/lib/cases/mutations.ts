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

/** Lists the current user's cases, paginated (backend default: page 1, limit 20). */
export function useCasesQuery(page = 1, limit = 20) {
  return useQuery({
    queryKey: caseKeys.list({ page, limit }),
    queryFn: () => apiFetch<{ total: number; data: CaseRecord[] }>(`/api/my-cases?page=${page}&limit=${limit}`),
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
  s3Key: string | null
  aiSummary: string | null
  createdAt: string
}

/** Uploads a file to the real document store (S3 + DB row via multipart POST /api/documents).
 * Pass `caseId` when the case already exists (e.g. Document Analysis); omit it when the file is
 * uploaded before the case does (e.g. Create Case), then link it after via useLinkCaseDocumentMutation. */
export function useUploadCaseDocumentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, caseId }: { file: File; caseId?: string }) => {
      const formData = new FormData()
      formData.append("file", file)
      if (caseId) formData.append("caseId", caseId)
      return apiFetch<UserDocument>("/api/documents", {
        method: "POST",
        body: formData,
      })
    },
    onSuccess: (doc) => {
      if (doc.caseId) {
        queryClient.invalidateQueries({ queryKey: caseKeys.timeline(doc.caseId) })
      }
    },
  })
}

/** Links a previously-uploaded document to a case, once the case has been created and its id is known. */
export function useLinkCaseDocumentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ documentId, caseId }: { documentId: string; caseId: string }) =>
      apiFetch<void>(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ caseId }),
      }),
    onSuccess: (_data, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.timeline(caseId) })
    },
  })
}
