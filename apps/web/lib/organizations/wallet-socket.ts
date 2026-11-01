import type { QueryClient } from "@tanstack/react-query"
import type { Socket } from "socket.io-client"
import { walletKeys } from "@/lib/query-keys"
import { CLIENT_HANDOFF_SOCKET_EVENTS } from "@/lib/client-handoff"

export const WALLET_UPDATED = CLIENT_HANDOFF_SOCKET_EVENTS.WALLET_UPDATED

// wallet:updated (ilovelawyer-api's WalletSvc.changed) goes to whoever manages a wallet when a client
// payment lands in it, an earning is released or refunded, or a withdrawal is paid or fails. It names
// the wallet's id, but the app caches a wallet under the workspace it was opened from (a firm's id,
// or OWN_WORKSPACE_ID), so every cached wallet is refetched: a lawyer has one or two. The REST routes
// stay the source of truth, as in socket.ts and shared.ts.

/** Subscribes wallet:updated on the shared socket, plus a refetch on reconnect for events missed
 * while it was down. Called once, from useNotificationSocket. Returns the cleanup. */
export function registerWalletSocketHandlers(socket: Socket, queryClient: QueryClient): () => void {
  const refetch = () => void queryClient.invalidateQueries({ queryKey: walletKeys.root })
  socket.on(WALLET_UPDATED, refetch)
  socket.on("connect", refetch)
  return () => {
    socket.off(WALLET_UPDATED, refetch)
    socket.off("connect", refetch)
  }
}
