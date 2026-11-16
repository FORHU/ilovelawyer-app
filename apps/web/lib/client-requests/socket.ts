import type { QueryClient } from "@tanstack/react-query"
import type { Socket } from "socket.io-client"
import { toast } from "sonner"
import i18n from "@/lib/i18n/i18n"
import { clientRequestKeys } from "@/lib/query-keys"
import { CLIENT_HANDOFF_SOCKET_EVENTS, type ClientRequestDeletedEvent, type EngagementAiBudgetEvent, type EngagementMessageEvent } from "@/lib/client-handoff"

const ENGAGEMENT_MESSAGE = CLIENT_HANDOFF_SOCKET_EVENTS.ENGAGEMENT_MESSAGE
const ENGAGEMENT_AI_BUDGET = CLIENT_HANDOFF_SOCKET_EVENTS.ENGAGEMENT_AI_BUDGET
const REQUEST_DELETED = CLIENT_HANDOFF_SOCKET_EVENTS.REQUEST_DELETED

// Client Request events on the shared notification socket (ilovelawyer-api's
// CLIENT_HANDOFF_SOCKET_EVENTS, lawyer-app side): client-request:new when one is routed to this
// lawyer, :taken once someone else claims it (or it's withdrawn or expires), :updated on any
// status change to a request they hold, :claim-expiring 2h before a 24h hold ends, :deleted when
// the client deletes the case. The REST routes stay the source of truth — every handler here
// just invalidates and lets the next fetch pick up the real state, same reasoning as
// document-socket.ts and shared.ts.

export const CLIENT_REQUEST_SOCKET_EVENTS = ["client-request:new", "client-request:taken", "client-request:updated", "client-request:claim-expiring"] as const

function invalidateClientRequests(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: clientRequestKeys.all })
}

/** Whether the lawyer has this request's page open (/homepage/client-requests/<id>). */
function isViewingRequest(requestId: string): boolean {
  return typeof window !== "undefined" && window.location.pathname.split("/").filter(Boolean).pop() === requestId
}

/** The client deleted the case: refetch, so the request leaves the lists and its page shows it's
 * gone, and say why to a lawyer who has it open. The bell tells the ones who were on it but have
 * moved on. */
export function onClientRequestDeleted(queryClient: QueryClient, event: ClientRequestDeletedEvent): void {
  invalidateClientRequests(queryClient)
  if (isViewingRequest(event.requestId)) toast.info(i18n.t("detail.deletedToast", { ns: "client-request" }))
}

/** Subscribes every client-request:* event on the shared socket. Called once, from
 * useNotificationSocket, so there's one listener set for the whole app. Returns the cleanup. */
export function registerClientRequestSocketHandlers(socket: Socket, queryClient: QueryClient): () => void {
  const handler = () => invalidateClientRequests(queryClient)
  const onDeleted = (event: ClientRequestDeletedEvent) => onClientRequestDeleted(queryClient, event)
  // The client posted in an engagement thread (#517): refetch that thread (and its unread count).
  const onMessage = (event: EngagementMessageEvent) => queryClient.invalidateQueries({ queryKey: clientRequestKeys.messages(event.requestId) })
  // An engagement's AI budget crossed 80% or 100%, or was topped up (#515, #516): refetch its meter.
  const onBudget = (event: EngagementAiBudgetEvent) => queryClient.invalidateQueries({ queryKey: clientRequestKeys.aiBudget(event.requestId) })
  CLIENT_REQUEST_SOCKET_EVENTS.forEach((event) => socket.on(event, handler))
  socket.on(REQUEST_DELETED, onDeleted)
  socket.on(ENGAGEMENT_MESSAGE, onMessage)
  socket.on(ENGAGEMENT_AI_BUDGET, onBudget)
  return () => {
    CLIENT_REQUEST_SOCKET_EVENTS.forEach((event) => socket.off(event, handler))
    socket.off(REQUEST_DELETED, onDeleted)
    socket.off(ENGAGEMENT_MESSAGE, onMessage)
    socket.off(ENGAGEMENT_AI_BUDGET, onBudget)
  }
}
