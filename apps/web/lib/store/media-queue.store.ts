import { create } from "zustand"

import { generateId } from "@/lib/id"

export interface QueuedDocument {
  id: string
  name: string
  meta: string
  file: File
}

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
}

interface MediaQueueState {
  documents: QueuedDocument[]
  transcripts: QueuedTranscript[]
  queueDocument: (file: File) => void
  removeDocument: (id: string) => void
  queueTranscript: (blob: Blob, durationSeconds: number, text?: string) => void
  removeTranscript: (id: string) => void
  updateTranscript: (id: string, patch: Partial<QueuedTranscript>) => void
}

// The Documents / Transcription pages are reached via plain <a> links in
// GlobalHeader, which are full browser navigations — an in-memory store alone
// would be wiped out on the hop from the consultation chat. IndexedDB (which,
// unlike localStorage, can hold File/Blob values directly) is what lets a file
// picked or a clip recorded on the chat page still be there after that reload.
const DB_NAME = "ilovelawyer-media-queue"
const DB_VERSION = 1
const DOCUMENTS_STORE = "documents"
const TRANSCRIPTS_STORE = "transcripts"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) db.createObjectStore(DOCUMENTS_STORE, { keyPath: "id" })
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
  documents: [],
  transcripts: [],

  queueDocument: (file) => {
    const doc: QueuedDocument = {
      id: generateId(),
      name: file.name,
      meta: `QUEUED FROM CONSULTATION • ${new Date().toLocaleString()}`,
      file,
    }
    set((state) => ({ documents: [doc, ...state.documents] }))
    dbPut(DOCUMENTS_STORE, doc).catch((err) => console.error("Failed to persist queued document:", err))
  },

  removeDocument: (id) => {
    set((state) => ({ documents: state.documents.filter((doc) => doc.id !== id) }))
    dbDelete(DOCUMENTS_STORE, id).catch((err) => console.error("Failed to remove queued document:", err))
  },

  queueTranscript: (blob, durationSeconds, text) => {
    const transcript: QueuedTranscript = {
      id: generateId(),
      name: `Recording_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
      meta: `QUEUED FROM CONSULTATION • ${Math.max(1, Math.round(durationSeconds))}s`,
      blob,
      durationSeconds,
      status: "local",
      text,
    }
    set((state) => ({ transcripts: [transcript, ...state.transcripts] }))
    dbPut(TRANSCRIPTS_STORE, transcript).catch((err) => console.error("Failed to persist queued transcript:", err))
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
  Promise.all([dbGetAll<QueuedDocument>(DOCUMENTS_STORE), dbGetAll<QueuedTranscript>(TRANSCRIPTS_STORE)])
    .then(([documents, transcripts]) => {
      // Older records predate the status field; treat them as never-submitted.
      const normalized = transcripts.map((t) => (t.status ? t : { ...t, status: "local" as const }))
      useMediaQueueStore.setState({ documents, transcripts: normalized })
    })
    .catch((err) => console.error("Failed to hydrate media queue from IndexedDB:", err))
}
