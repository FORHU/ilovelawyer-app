import { useSyncExternalStore } from "react"
import type { QueryClient } from "@tanstack/react-query"
import type { Socket } from "socket.io-client"
import { caseKeys, chatKeys } from "@/lib/query-keys"
import { terminalKeys } from "@/lib/terminal/mutations"
import { graphViewKeys } from "@/lib/graph-view/mutations"
import type { UserDocument } from "@/lib/cases/mutations"

/** Live Case Document extraction events pushed by ilovelawyer-api's DocumentExtractionSvc over
 * the shared notification socket (mirrors DocumentSocketEvent / DocumentSocketPayload in
 * ilovelawyer-api/src/lib/socket.ts). Document.ragStatus in the DB stays the source of truth —
 * these only let the UI skip polling, exactly like chat:* events. */
export const DOCUMENT_SOCKET_EVENTS = [
  "document:started",
  "document:ready",
  "document:failed",
  "document:retrying",
] as const

export type DocumentSocketEvent = (typeof DOCUMENT_SOCKET_EVENTS)[number]

export interface DocumentSocketPayload {
  documentId: string
  caseId: string | null
  consultationId: string | null
  ragStatus: UserDocument["ragStatus"]
  pageCount?: number | null
  category?: string | null
}

// Which documents the worker is extracting RIGHT NOW (document:started seen, no ready/failed/
// retrying since). Purely a client-side refinement of ragStatus PENDING — lets the badge tell
// "Queued" from "Indexing" without a new database state. A reload forgets it, and the row simply
// reads "Queued" until the next event. Same external-store shape as the socket's own status
// (lib/notifications/socket.ts), for the same reason: it isn't server data.
const indexingIds = new Set<string>()
const indexingListeners = new Set<() => void>()
// useSyncExternalStore needs a stable snapshot between changes, so per-id reads go through a
// version counter rather than handing out the mutable Set.
let indexingVersion = 0

function setIndexing(documentId: string, indexing: boolean): void {
  if (indexing === indexingIds.has(documentId)) return
  if (indexing) indexingIds.add(documentId)
  else indexingIds.delete(documentId)
  indexingVersion += 1
  indexingListeners.forEach((listener) => listener())
}

function subscribeIndexing(callback: () => void): () => void {
  indexingListeners.add(callback)
  return () => indexingListeners.delete(callback)
}

/** True while the worker is actively extracting this document (see indexingIds). */
export function useIsDocumentIndexing(documentId: string | undefined): boolean {
  useSyncExternalStore(subscribeIndexing, () => indexingVersion, () => 0)
  return !!documentId && indexingIds.has(documentId)
}

function patchDocuments(payload: DocumentSocketPayload) {
  return (docs?: UserDocument[]) => {
    if (!docs) return docs
    let found = false
    const next = docs.map((doc) => {
      if (doc.id !== payload.documentId) return doc
      found = true
      return {
        ...doc,
        ragStatus: payload.ragStatus,
        ...(payload.category ? { category: payload.category } : {}),
      }
    })
    // Untouched cache => same reference, so nothing re-renders for a document this list doesn't hold.
    return found ? next : docs
  }
}

/** Applies one document:* event to React Query's caches in place. Idempotent — it writes an
 * absolute status, so a duplicate or replayed event (the queue's stuck-document sweep re-runs
 * documents) is harmless. */
export function applyDocumentEvent(
  queryClient: QueryClient,
  event: DocumentSocketEvent,
  payload: DocumentSocketPayload,
): void {
  setIndexing(payload.documentId, event === "document:started")

  const patch = patchDocuments(payload)
  // Prefix-matches both the active and the archived list for the case.
  if (payload.caseId) queryClient.setQueriesData<UserDocument[]>({ queryKey: caseKeys.timeline(payload.caseId) }, patch)
  if (payload.consultationId) {
    queryClient.setQueryData<UserDocument[]>(chatKeys.documents(payload.consultationId), patch)
  }

  // The Terminal's snapshot embeds each document's ragStatus and pageCount and otherwise only
  // refreshes on a long idle poll. Not on "started" — it changes nothing the snapshot shows.
  // "retrying" is included so a retried document leaves the red FAILED state right away.
  // Immediate, not debounced: Studio's Data Table tile is meant to auto-refresh live as each
  // document finishes, not settle only once a batch quiets down.
  if (payload.caseId && event !== "document:started") {
    queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(payload.caseId) })
    // A finished extraction can add key-date timeline events for this document.
    if (event === "document:ready") queryClient.invalidateQueries({ queryKey: graphViewKeys.all(payload.caseId) })
  }
}

/** Subscribes every document:* event on the shared socket. Called once, from
 * useNotificationSocket, so there's one listener set for the whole app. Returns the cleanup. */
export function registerDocumentSocketHandlers(socket: Socket, queryClient: QueryClient): () => void {
  const registered = DOCUMENT_SOCKET_EVENTS.map((event) => {
    const handler = (payload: DocumentSocketPayload) => applyDocumentEvent(queryClient, event, payload)
    socket.on(event, handler)
    return { event, handler }
  })

  return () => {
    registered.forEach(({ event, handler }) => socket.off(event, handler))
  }
}
