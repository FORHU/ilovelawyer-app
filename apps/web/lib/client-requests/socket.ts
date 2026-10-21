import type { QueryClient } from "@tanstack/react-query"
import type { Socket } from "socket.io-client"
import { CLIENT_HANDOFF_SOCKET_EVENTS } from "@/lib/client-handoff"
import { invalidateOnClientRequestTaken } from "@/lib/client-requests/inbox"

/**
 * Real-socket handling for the Client Requests inbox, following lib/cases/shared.ts's
 * registerShareSocketHandlers pattern. Forward-compatible: ilovelawyer-api doesn't emit any
 * `client-request:*` event yet (#509/#511 aren't built — see mock-backend.ts), so this is a
 * no-op today. Once it does, this is already wired into useNotificationSocket below and needs
 * no further change; drop lib/client-requests/mock-backend.ts's BroadcastChannel transport
 * (used by useClientRequestLiveUpdates in inbox.ts) at that point instead.
 */
type InboxSocket = Pick<Socket, "on" | "off">

export function registerClientRequestSocketHandlers(socket: InboxSocket, queryClient: QueryClient): () => void {
  const handleTaken = () => invalidateOnClientRequestTaken(queryClient)
  const handleNewOrUpdated = () => invalidateOnClientRequestTaken(queryClient)
  // A push missed while disconnected: catch up on reconnect, same reasoning as every other
  // socket consumer in this app (see useNotificationSocket).
  const handleConnect = () => invalidateOnClientRequestTaken(queryClient)

  socket.on(CLIENT_HANDOFF_SOCKET_EVENTS.REQUEST_TAKEN, handleTaken)
  socket.on(CLIENT_HANDOFF_SOCKET_EVENTS.REQUEST_NEW, handleNewOrUpdated)
  socket.on(CLIENT_HANDOFF_SOCKET_EVENTS.REQUEST_UPDATED, handleNewOrUpdated)
  socket.on("connect", handleConnect)

  return () => {
    socket.off(CLIENT_HANDOFF_SOCKET_EVENTS.REQUEST_TAKEN, handleTaken)
    socket.off(CLIENT_HANDOFF_SOCKET_EVENTS.REQUEST_NEW, handleNewOrUpdated)
    socket.off(CLIENT_HANDOFF_SOCKET_EVENTS.REQUEST_UPDATED, handleNewOrUpdated)
    socket.off("connect", handleConnect)
  }
}
