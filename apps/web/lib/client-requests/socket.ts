import type { QueryClient } from "@tanstack/react-query"
import type { Socket } from "socket.io-client"
import { clientRequestKeys } from "@/lib/query-keys"
import { CLIENT_HANDOFF_SOCKET_EVENTS, type EngagementAiBudgetEvent } from "@/lib/client-handoff"

const ENGAGEMENT_AI_BUDGET = CLIENT_HANDOFF_SOCKET_EVENTS.ENGAGEMENT_AI_BUDGET

// Client Request events on the shared notification socket (ilovelawyer-api's
// CLIENT_HANDOFF_SOCKET_EVENTS, lawyer-app side): client-request:new when one is routed to this
// lawyer, :taken once someone else claims it (or it's withdrawn or expires), :updated on any
// status change to a request they hold, :claim-expiring 2h before a 24h hold ends. The REST
// routes stay the source of truth — every handler here just invalidates and lets the next fetch
// pick up the real state, same reasoning as document-socket.ts and shared.ts.

export const CLIENT_REQUEST_SOCKET_EVENTS = ["client-request:new", "client-request:taken", "client-request:updated", "client-request:claim-expiring"] as const

function invalidateClientRequests(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: clientRequestKeys.all })
}

/** Subscribes every client-request:* event on the shared socket. Called once, from
 * useNotificationSocket, so there's one listener set for the whole app. Returns the cleanup. */
export function registerClientRequestSocketHandlers(socket: Socket, queryClient: QueryClient): () => void {
  const handler = () => invalidateClientRequests(queryClient)
  // An engagement's AI budget crossed 80% or 100%, or was topped up (#515, #516): refetch its meter.
  const onBudget = (event: EngagementAiBudgetEvent) => queryClient.invalidateQueries({ queryKey: clientRequestKeys.aiBudget(event.requestId) })
  CLIENT_REQUEST_SOCKET_EVENTS.forEach((event) => socket.on(event, handler))
  socket.on(ENGAGEMENT_AI_BUDGET, onBudget)
  return () => {
    CLIENT_REQUEST_SOCKET_EVENTS.forEach((event) => socket.off(event, handler))
    socket.off(ENGAGEMENT_AI_BUDGET, onBudget)
  }
}
