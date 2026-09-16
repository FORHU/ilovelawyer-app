import { io, type Socket } from "socket.io-client"
import { API_BASE_URL } from "@/lib/fetch"
import { useAuthStore } from "@/lib/store/auth.store"

let socket: Socket | null = null

export type SocketStatus = "connected" | "disconnected" | "reconnecting"

// A tiny external store (see useNotificationSocketStatus in queries.ts, via
// useSyncExternalStore) tracking the one shared socket's live status — separate from
// React Query's caches because this isn't server data, it's the connection's own state,
// and nothing here is async in the query sense (there's no "fetch" to represent).
let status: SocketStatus = "disconnected"
const statusListeners = new Set<() => void>()

function setStatus(next: SocketStatus): void {
  if (status === next) return
  status = next
  statusListeners.forEach((listener) => listener())
}

export function getSocketStatus(): SocketStatus {
  return status
}

export function subscribeSocketStatus(callback: () => void): () => void {
  statusListeners.add(callback)
  return () => statusListeners.delete(callback)
}

/**
 * One lazily-created socket for the whole app, not one per hook instance — React Query's
 * caches are global too, so there's no benefit to a connection per mounted component, only
 * redundant handshakes. `auth` is a callback (not a static object) so socket.io-client reads
 * `useAuthStore.getState().accessToken` fresh on every (re)connection attempt instead of
 * closing over whatever token existed when the socket was first created — the access token
 * rotates on refresh, same as every apiFetch call (see buildHeaders in lib/fetch.ts).
 */
export function getNotificationSocket(): Socket {
  if (socket) return socket

  socket = io(API_BASE_URL, {
    autoConnect: false,
    withCredentials: true,
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
  })

  // Status tracking lives here, at creation time, rather than in useNotificationSocket's
  // effect — the socket is a singleton so its connection lifecycle should be tracked once,
  // in one place, regardless of how many components come and go. `disconnect` fires on both
  // a manual .disconnect() (logout — no auto-reconnect follows, status correctly stays
  // "disconnected") and an unexpected drop (which socket.io-client, by default, immediately
  // follows with reconnection attempts — "reconnect_attempt" then overwrites the status to
  // "reconnecting" a moment later). Reconnection events live on the Manager (`socket.io`),
  // not the Socket itself — see socket.io-client's client API.
  socket.on("connect", () => setStatus("connected"))
  socket.on("disconnect", () => setStatus("disconnected"))
  socket.io.on("reconnect_attempt", () => setStatus("reconnecting"))

  return socket
}
