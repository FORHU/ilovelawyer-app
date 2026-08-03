import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { caseKeys, transcriptionKeys } from "@/lib/query-keys"

export interface UploadedFile {
  id: string
  filename: string | null
  fileUrl: string | null
}

export interface Transcription {
  id: string
  userId: string
  caseId: string | null
  audioFileId: string | null
  title: string | null
  transcript: string | null
  duration: number | null
  jobName: string | null
  status: string | null
  createdAt: string
  updatedAt: string
}

export interface PollJobResult {
  status: string
  transcript?: string
  failureReason?: string
}

/** Uploads an audio Blob to the generic file store — must bypass JSON content-type (multipart). */
export function useUploadAudioMutation() {
  return useMutation({
    mutationFn: ({ blob, filename }: { blob: Blob; filename: string }) => {
      const formData = new FormData()
      formData.append("file", blob, filename)
      return apiFetch<UploadedFile>("/api/files/upload", {
        method: "POST",
        body: formData,
      })
    },
  })
}

export function useCreateTranscriptionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      title,
      audioFileId,
      duration,
      caseId,
    }: {
      title: string
      audioFileId: string
      duration: number
      caseId?: string
    }) =>
      apiFetch<Transcription>("/api/transcriptions", {
        method: "POST",
        body: JSON.stringify({ title, audioFileId, duration, caseId }),
      }),
    onSuccess: (transcription) => {
      if (transcription.caseId) {
        queryClient.invalidateQueries({ queryKey: caseKeys.timeline(transcription.caseId) })
      }
    },
  })
}

export function useStartTranscriptionJobMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ jobName: string; status: string }>(`/api/transcriptions/${id}/start-job`, {
        method: "POST",
      }),
  })
}

/** One-shot status check — callers drive their own polling loop with this. */
export function pollTranscriptionJob(id: string): Promise<PollJobResult> {
  return apiFetch<PollJobResult>(`/api/transcriptions/${id}/poll-job`)
}

export function useTranscriptionsQuery() {
  return useQuery({
    queryKey: transcriptionKeys.lists(),
    queryFn: () => apiFetch<Transcription[]>("/api/transcriptions"),
  })
}

/** Attaches/reattaches (or clears, with `caseId: null`) the case a transcription belongs to,
 * for transcriptions that were created without one or need to move to a different case. */
export function useLinkTranscriptionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, caseId }: { id: string; caseId: string | null }) =>
      apiFetch<Transcription>(`/api/transcriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ caseId }),
      }),
    onSuccess: (_data, { id, caseId }) => {
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.detail(id) })
      if (caseId) queryClient.invalidateQueries({ queryKey: caseKeys.timeline(caseId) })
    },
  })
}

export function useDeleteTranscriptionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/transcriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.lists() })
    },
  })
}
