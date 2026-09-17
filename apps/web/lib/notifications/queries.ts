import { useEffect, useSyncExternalStore } from "react"
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { notificationKeys, chatKeys } from "@/lib/query-keys"
import { getNotificationSocket, getSocketStatus, subscribeSocketStatus, type SocketStatus } from "@/lib/notifications/socket"
import { useAuthStore } from "@/lib/store/auth.store"

/** Mirrors the backend's free-form `type` string (see notification.validation.ts on the API) —
 * kept as a union here so UI code (icon/label per type) can switch over it exhaustively. */
export type NotificationType = "EVENT_REMINDER" | "CASE_UPDATE" | "SYSTEM"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  /** App-relative path to navigate to on click (e.g. "/homepage/calendar"), if any. */
  link: string | null
  isRead: boolean
  createdAt: string
}

interface NotificationListResponse {
  notifications: Notification[]
  nextCursor: string | null
}

export function useUnreadCountQuery() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => apiFetch<{ count: number }>("/api/notifications/unread-count"),
    select: (data) => data.count,
    // No refetchInterval — useNotificationSocket pushes new counts in over the socket as they
    // happen. refetchOnWindowFocus stays on as a cheap reconciliation for the gap between
    // "tab was backgrounded/asleep long enough the socket dropped" and the socket's own
    // reconnect-triggered invalidation (see useNotificationSocket) catching up.
    refetchOnWindowFocus: true,
  })
}

export function useNotificationsQuery(options?: { limit?: number; enabled?: boolean }) {
  const limit = options?.limit ?? 20
  return useQuery({
    queryKey: notificationKeys.list({ limit }),
    queryFn: () => apiFetch<NotificationListResponse>(`/api/notifications?limit=${limit}`),
    enabled: options?.enabled,
  })
}

/**
 * Opens the app's one notification socket (see lib/notifications/socket.ts) and keeps
 * React Query's notification AND chat caches live from it — mounted once for the whole app, in
 * Providers (NotificationSocketBridge), not per-component: the bell itself renders twice
 * (desktop nav + the always-mounted mobile drawer), so calling this from there would open
 * two connections and double-apply every push. `notification:new` patches the unread-count and any
 * currently-mounted list/infinite-list caches directly (so the badge/popover update with zero
 * latency); a fresh `connect` (including every reconnect after a dropped connection) instead
 * invalidates everything, since a gap in the connection means pushes could have been missed
 * and only a real refetch can be trusted to reconcile that.
 *
 * The chat invalidation is this same "gap in the connection" reasoning applied to
 * chat:chunk/chat:done/chat:error (see subscribeChatGeneration in lib/chat/mutations.ts): a
 * page mid-generation that loses its socket (background tab throttled, network blip) and
 * later reconnects needs exactly one fresh GET /messages to pick up whatever it missed —
 * `invalidateQueries`'s default `refetchType: "active"` means only currently-mounted queries
 * actually refetch, so this is a no-op for any consultation nobody's looking at.
 */
export function useNotificationSocket() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!accessToken) return

    const socket = getNotificationSocket()

    const handleConnect = () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      queryClient.invalidateQueries({ queryKey: chatKeys.all })
    }

    const handleNew = (notification: Notification) => {
      queryClient.setQueryData<{ count: number }>(notificationKeys.unreadCount(), (old) => ({
        count: (old?.count ?? 0) + 1,
      }))

      queryClient.getQueriesData({ queryKey: notificationKeys.lists() }).forEach(([key, data]) => {
        if (!data) return
        if (Array.isArray((data as { pages?: unknown }).pages)) {
          const infiniteData = data as { pages: NotificationListResponse[]; pageParams: unknown[] }
          const [firstPage, ...restPages] = infiniteData.pages
          if (!firstPage) return
          queryClient.setQueryData(key, {
            ...infiniteData,
            pages: [{ ...firstPage, notifications: [notification, ...firstPage.notifications] }, ...restPages],
          })
        } else {
          const listData = data as NotificationListResponse
          queryClient.setQueryData(key, { ...listData, notifications: [notification, ...listData.notifications] })
        }
      })
    }

    socket.on("connect", handleConnect)
    socket.on("notification:new", handleNew)
    socket.connect()

    return () => {
      socket.off("connect", handleConnect)
      socket.off("notification:new", handleNew)
      socket.disconnect()
    }
  }, [accessToken, queryClient])
}

function getServerSocketStatus(): SocketStatus {
  return "disconnected"
}

/**
 * The socket's live connection status, for UI that wants to reflect it (the bell's
 * "reconnecting…" indicator) — useSyncExternalStore rather than useEffect+useState because
 * this is a read of externally-owned state (lib/notifications/socket.ts's module-level
 * status), not something this hook's component owns or causes; useSyncExternalStore is also
 * the one hook that's safe against tearing under concurrent rendering, where a manual
 * useEffect subscription can show stale values on some renders. getServerSocketStatus covers
 * SSR, where the socket never connects at all.
 */
export function useNotificationSocketStatus(): SocketStatus {
  return useSyncExternalStore(subscribeSocketStatus, getSocketStatus, getServerSocketStatus)
}

const PAGE_SIZE = 20

/** Cursor-paginated feed for the dedicated "view all" page — the popover uses the simpler,
 * single-page useNotificationsQuery above since it only ever shows the most recent handful. */
export function useInfiniteNotificationsQuery(filters?: { unreadOnly?: boolean }) {
  const unreadOnly = filters?.unreadOnly ?? false
  return useInfiniteQuery({
    queryKey: notificationKeys.list({ limit: PAGE_SIZE, unreadOnly, paginated: true }),
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (pageParam) params.set("cursor", pageParam)
      if (unreadOnly) params.set("unreadOnly", "true")
      return apiFetch<NotificationListResponse>(`/api/notifications?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

function markOneRead(notifications: Notification[], id: string): { notifications: Notification[]; wasUnread: boolean } {
  let wasUnread = false
  const next = notifications.map((n) => {
    if (n.id !== id) return n
    if (!n.isRead) wasUnread = true
    return { ...n, isRead: true }
  })
  return { notifications: next, wasUnread }
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/notifications/${id}/read`, { method: "PUT" }),
    // Optimistic: flips isRead in every cached list immediately and decrements the badge,
    // so clicking a notification feels instant instead of waiting on the next poll. Handles
    // both the flat popover cache (NotificationListResponse) and the "view all" page's
    // useInfiniteQuery cache ({ pages: NotificationListResponse[] }) shapes.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })
      const previousLists = queryClient.getQueriesData({ queryKey: notificationKeys.lists() })
      let wasUnread = false

      previousLists.forEach(([key, data]) => {
        if (!data) return
        if (Array.isArray((data as { pages?: unknown }).pages)) {
          const infiniteData = data as { pages: NotificationListResponse[]; pageParams: unknown[] }
          const pages = infiniteData.pages.map((page) => {
            const result = markOneRead(page.notifications, id)
            if (result.wasUnread) wasUnread = true
            return { ...page, notifications: result.notifications }
          })
          queryClient.setQueryData(key, { ...infiniteData, pages })
        } else {
          const listData = data as NotificationListResponse
          const result = markOneRead(listData.notifications, id)
          if (result.wasUnread) wasUnread = true
          queryClient.setQueryData(key, { ...listData, notifications: result.notifications })
        }
      })

      const previousCount = queryClient.getQueryData<{ count: number }>(notificationKeys.unreadCount())
      if (wasUnread && previousCount) {
        queryClient.setQueryData(notificationKeys.unreadCount(), { count: Math.max(0, previousCount.count - 1) })
      }

      return { previousLists, previousCount }
    },
    onError: (_err, _id, context) => {
      context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      if (context?.previousCount) queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>("/api/notifications/read-all", { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
