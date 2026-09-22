import { useEffect, useSyncExternalStore } from "react"
import type { Socket } from "socket.io-client"
import { getNotificationSocket } from "@/lib/notifications/socket"

// Which caseIds this socket currently has a confirmed case:<id> room join for (see lib/socket.ts's
// case:subscribe handler) — lets a reader (useAiJobStatus) tell "push should be live for this
// case" from "nothing confirmed the join yet, trust the poll." Same external-store shape as the
// socket's own connection status (lib/notifications/socket.ts) and the document-indexing flag
// (lib/cases/document-socket.ts), for the same reason: it isn't server data React Query owns.
const subscribedCaseIds = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function setSubscribed(caseId: string, subscribed: boolean): void {
  if (subscribed === subscribedCaseIds.has(caseId)) return
  if (subscribed) subscribedCaseIds.add(caseId)
  else subscribedCaseIds.delete(caseId)
  version += 1
  listeners.forEach((listener) => listener())
}

function subscribeToStore(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/** Minimal slice of socket.io-client's Socket this module needs — kept narrow (rather than
 * importing the real Socket type for the parameter) purely so joinCaseRoom is trivial to drive
 * with a plain fake in tests, no socket.io-client instance required. */
interface CaseRoomSocket {
  connected: boolean
  emit(event: "case:subscribe", payload: { caseId: string }, ack: (res?: { ok: boolean; error?: string }) => void): void
  emit(event: "case:unsubscribe", payload: { caseId: string }): void
  on(event: "connect", handler: () => void): void
  off(event: "connect", handler: () => void): void
}

/**
 * Joins `socket` to `case:<caseId>`'s broadcast room for as long as the caller keeps it active —
 * the room AiGenerationLockSvc's ai-job:started/done/failed events go to (unlike chat/document
 * pushes, an AI generation job is keyed on caseId+kind, not on who triggered it, so it belongs on
 * a case-wide room rather than the per-user one every connection already joins). Pure function,
 * no React — useCaseRoom below is a thin useEffect wrapper around it, kept separate so this join/
 * reconnect/leave logic is directly testable without a component-rendering harness.
 *
 * Re-subscribes on every socket reconnect, not just once at the start: Socket.IO's server-side
 * room membership doesn't survive a dropped connection even though the client-side Socket object
 * does — a join made only once would silently stop working after any reconnect without this.
 *
 * Returns the cleanup: stops re-subscribing on reconnect, tells the server to leave the room, and
 * clears the local "subscribed" flag.
 */
export function joinCaseRoom(socket: CaseRoomSocket, caseId: string): () => void {
  const subscribe = () => {
    socket.emit("case:subscribe", { caseId }, (res) => {
      setSubscribed(caseId, res?.ok === true)
    })
  }

  if (socket.connected) subscribe()
  socket.on("connect", subscribe)

  return () => {
    socket.off("connect", subscribe)
    socket.emit("case:unsubscribe", { caseId })
    setSubscribed(caseId, false)
  }
}

/** Mount this ONCE per case, high up (LegalTerminal's root) — not from every panel or hook that
 * reads job status, so opening several Terminal panels for the same case doesn't join the room
 * three times over; see joinCaseRoom for the actual join/reconnect/leave logic. */
export function useCaseRoom(caseId: string | undefined): void {
  useEffect(() => {
    if (!caseId) return
    return joinCaseRoom(getNotificationSocket(), caseId)
  }, [caseId])
}

/** True once `caseId`'s case:subscribe ack has actually come back `ok` — not just "a
 * useCaseRoom(caseId) is mounted somewhere," which could still be mid-handshake or have been
 * denied. */
export function isCaseRoomSubscribed(caseId: string | undefined): boolean {
  return !!caseId && subscribedCaseIds.has(caseId)
}

/** Reactive counterpart of isCaseRoomSubscribed — readers (useAiJobStatus) use this to decide
 * whether a live push can be trusted for this case, distinct from useNotificationSocketStatus's
 * "connected" (the room is per-case; the connection is per-browser-tab). */
export function useIsCaseRoomSubscribed(caseId: string | undefined): boolean {
  useSyncExternalStore(subscribeToStore, () => version, () => 0)
  return isCaseRoomSubscribed(caseId)
}
