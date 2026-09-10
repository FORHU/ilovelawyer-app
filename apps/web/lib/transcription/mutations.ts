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

const POLL_INTERVAL_MS = 4000
const MAX_POLL_ATTEMPTS = 150 // ~10 minutes ceiling for a single batch job

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Polls a started job to completion — resolves once AWS Transcribe reports COMPLETED or
 * FAILED, or resolves as FAILED after MAX_POLL_ATTEMPTS so callers always get a result to
 * branch on instead of hanging forever. A network/API error from pollTranscriptionJob
 * itself still rejects — callers decide how to handle that (see useTranscriptionPolling). */
export async function pollTranscriptionJobUntilDone(id: string): Promise<PollJobResult> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS)
    const result = await pollTranscriptionJob(id)
    if (result.status === "COMPLETED" || result.status === "FAILED") return result
  }
  return { status: "FAILED", failureReason: "Timed out waiting for the transcription job." }
}

export interface ChunkTranscriptionResult {
  ragStatus: string
  chunkCount: number
}

/** Chunks + embeds a completed transcript so Case Chat can retrieve excerpts from it (see
 * docs/adr/0013-transcript-rag-chunking.md). Called once, right after a job reaches COMPLETED —
 * not a hook, since it's fired imperatively from useTranscriptionPolling's poll loop rather than
 * from component render. */
export function chunkTranscription(id: string): Promise<ChunkTranscriptionResult> {
  return apiFetch<ChunkTranscriptionResult>(`/api/transcriptions/${id}/chunk`, { method: "POST" })
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
