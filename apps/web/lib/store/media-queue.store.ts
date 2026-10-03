import { useMemo } from "react"
import { create } from "zustand"

import { generateId } from "@/lib/id"
import { useAuthStore } from "@/lib/store/auth.store"

// Lifecycle of a queued recording/upload once the user hits "Transcribe":
// local (never submitted) -> uploading -> starting -> in_progress (AWS Transcribe job running) -> completed | failed
export type TranscriptionStatus = "local" | "uploading" | "starting" | "in_progress" | "completed" | "failed"

export interface QueuedTranscript {
  id: string
  name: string
  meta: string
  blob: Blob
  durationSeconds: number
  status: TranscriptionStatus
  backendId?: string
  transcript?: string
  errorMessage?: string
  /** Live-captured speech-to-text transcript, when the browser supports it. Undefined for uploaded files. */
  text?: string
  /** Where it was queued from. Absent on records that predate it. */
  source?: QueueSource
  /** `${userId}:${organizationId}` of whoever queued it — see currentOwnerKey. Absent on records
   * that predate it. */
  ownerKey?: string
}

export type QueueSource = "consultation" | "recorder" | "upload"

const SOURCE_LABEL: Record<QueueSource, string> = {
  consultation: "QUEUED FROM CONSULTATION",
  recorder: "RECORDED HERE",
  upload: "UPLOADED",
}

/** The queue lives in this browser's IndexedDB, which every account signed in on it shares —
 * without an owner, one account's recordings showed in another's queue while that account's
 * Library (server-side, per organization) rightly had none of them. */
export function currentOwnerKey(): string | null {
  const { user, organization } = useAuthStore.getState()
  return user && organization ? `${user.id}:${organization.id}` : null
}

/** The signed-in account's own queue items. Legacy items with no owner stay visible. */
export function useOwnQueuedTranscripts(): QueuedTranscript[] {
  const transcripts = useMediaQueueStore((s) => s.transcripts)
  const ownerKey = useAuthStore((s) => (s.user && s.organization ? `${s.user.id}:${s.organization.id}` : null))
  return useMemo(
    () => transcripts.filter((t) => !t.ownerKey || t.ownerKey === ownerKey),
    [transcripts, ownerKey],
  )
}

interface MediaQueueState {
  transcripts: QueuedTranscript[]
  /** Returns the new local queue id — callers that go on to drive it through the real
   * transcription pipeline (upload → create → start-job → poll) need it for updateTranscript. */
  queueTranscript: (blob: Blob, durationSeconds: number, opts?: { text?: string; source: QueueSource }) => string
  removeTranscript: (id: string) => void
  updateTranscript: (id: string, patch: Partial<QueuedTranscript>) => void
}

// The Transcription page is reached via a plain <a> link in GlobalHeader, a full browser
// navigation — an in-memory store alone would be wiped out on the hop from the consultation
// chat. IndexedDB (which, unlike localStorage, can hold Blob values directly) is what lets a
// clip recorded on the chat page still be there after that reload.
const DB_NAME = "ilovelawyer-media-queue"
const DB_VERSION = 1
const TRANSCRIPTS_STORE = "transcripts"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(TRANSCRIPTS_STORE)) db.createObjectStore(TRANSCRIPTS_STORE, { keyPath: "id" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly")
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

async function dbPut(storeName: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    tx.objectStore(storeName).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function dbDelete(storeName: string, id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    tx.objectStore(storeName).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const useMediaQueueStore = create<MediaQueueState>()((set) => ({
  transcripts: [],

  queueTranscript: (blob, durationSeconds, { text, source } = { source: "consultation" }) => {
    const transcript: QueuedTranscript = {
      id: generateId(),
      name:
        source === "upload" && blob instanceof File && blob.name
          ? blob.name
          : `Recording_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
      meta: `${SOURCE_LABEL[source]} • ${Math.max(1, Math.round(durationSeconds))}s`,
      blob,
      durationSeconds,
      status: "local",
      text,
      source,
      ownerKey: currentOwnerKey() ?? undefined,
    }
    set((state) => ({ transcripts: [transcript, ...state.transcripts] }))
    dbPut(TRANSCRIPTS_STORE, transcript).catch((err) => console.error("Failed to persist queued transcript:", err))
    return transcript.id
  },

  removeTranscript: (id) => {
    set((state) => ({ transcripts: state.transcripts.filter((t) => t.id !== id) }))
    dbDelete(TRANSCRIPTS_STORE, id).catch((err) => console.error("Failed to remove queued transcript:", err))
  },

  updateTranscript: (id, patch) => {
    let updated: QueuedTranscript | undefined
    set((state) => ({
      transcripts: state.transcripts.map((t) => {
        if (t.id !== id) return t
        updated = { ...t, ...patch }
        return updated
      }),
    }))
    if (updated) {
      dbPut(TRANSCRIPTS_STORE, updated).catch((err) => console.error("Failed to persist transcript update:", err))
    }
  },
}))

if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
  dbGetAll<QueuedTranscript>(TRANSCRIPTS_STORE)
    .then((transcripts) => {
      // Older records predate the status field; treat them as never-submitted.
      const normalized = transcripts.map((t) => (t.status ? t : { ...t, status: "local" as const }))
      useMediaQueueStore.setState({ transcripts: normalized })
    })
    .catch((err) => console.error("Failed to hydrate media queue from IndexedDB:", err))
}
