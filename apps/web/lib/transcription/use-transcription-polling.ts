import { useEffect, useRef } from "react"
import { useMediaQueueStore } from "@/lib/store/media-queue.store"
import { pollTranscriptionJobUntilDone, chunkTranscription } from "@/lib/transcription/mutations"

/**
 * Drives every queued transcript currently sitting at status "in_progress" to
 * completion by polling AWS Transcribe via the backend. Mounting this once
 * (e.g. at the top of the Transcription page) is what makes a job resume —
 * on return, any item hydrated from IndexedDB as "in_progress" picks a poll
 * loop back up automatically instead of being stuck mid-job forever.
 */
export function useTranscriptionPolling() {
  const transcripts = useMediaQueueStore((s) => s.transcripts)
  const updateTranscript = useMediaQueueStore((s) => s.updateTranscript)
  const inFlight = useRef(new Set<string>())

  useEffect(() => {
    for (const item of transcripts) {
      if (item.status !== "in_progress" || !item.backendId) continue
      if (inFlight.current.has(item.id)) continue

      inFlight.current.add(item.id)
      const localId = item.id
      const backendId = item.backendId

      ;(async () => {
        try {
          const result = await pollTranscriptionJobUntilDone(backendId)
          if (result.status === "COMPLETED") {
            updateTranscript(localId, { status: "completed", transcript: result.transcript ?? "" })
            // Fire-and-forget: makes the transcript retrievable by Case Chat (ADR 0013). Not
            // yet live on the backend as of this writing — failures are swallowed so a missing
            // endpoint there can't regress the transcript's own completed status here.
            chunkTranscription(backendId).catch((err) => {
              console.error("Failed to chunk transcription for RAG retrieval:", err)
            })
          } else {
            updateTranscript(localId, {
              status: "failed",
              errorMessage: result.failureReason ?? "AWS Transcribe reported the job as failed.",
            })
          }
        } catch (err) {
          updateTranscript(localId, { status: "failed", errorMessage: (err as Error).message })
        }
      })().finally(() => {
        inFlight.current.delete(localId)
      })
    }
  }, [transcripts, updateTranscript])
}
