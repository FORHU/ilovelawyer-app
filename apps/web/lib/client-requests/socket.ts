import type { QueryClient } from "@tanstack/react-query"
import type { Socket } from "socket.io-client"
import { clientRequestKeys } from "@/lib/query-keys"

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
  CLIENT_REQUEST_SOCKET_EVENTS.forEach((event) => socket.on(event, handler))
  return () => CLIENT_REQUEST_SOCKET_EVENTS.forEach((event) => socket.off(event, handler))
}
