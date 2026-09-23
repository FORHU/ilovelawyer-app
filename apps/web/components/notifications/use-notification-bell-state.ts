"use client"
import { useRouter } from "next/navigation"
import { useMobileNavStore } from "@/lib/store/mobile-nav.store"
import {
  useNotificationsQuery,
  useUnreadCountQuery,
  useNotificationSocketStatus,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  type Notification,
} from "@/lib/notifications/queries"

const LIST_LIMIT = 8

/** Shared query/mutation wiring behind the bell — used by both NotificationBell's desktop
 * popover and GlobalHeader's mobile inline panel, so the two never drift on the list limit,
 * the "just reconnected, might have missed one" flag, or what happens when a notification
 * is opened. `open` gates the list fetch itself (no point paying for it before it's ever
 * shown) — the unread badge count has its own always-on query. `onClose` is whatever the
 * caller's own "hide the panel again" is (closing the popover, collapsing the inline panel
 * back to the nav list) — this hook always also closes the mobile hamburger drawer itself,
 * since a notification's link navigates away and would otherwise leave the drawer sitting
 * open over the destination page. */
export function useNotificationBellState(open: boolean, onClose: () => void) {
  const router = useRouter()
  const closeMobileMenu = useMobileNavStore((s) => s.close)

  const unreadCountQuery = useUnreadCountQuery()
  const notificationsQuery = useNotificationsQuery({ limit: LIST_LIMIT, enabled: open })
  const socketStatus = useNotificationSocketStatus()
  const markRead = useMarkNotificationReadMutation()
  const markAllRead = useMarkAllNotificationsReadMutation()

  const unreadCount = unreadCountQuery.data ?? 0
  const notifications = notificationsQuery.data?.notifications ?? []
  const hasUnread = unreadCount > 0
  // "disconnected" alone isn't shown — it's also the resting state before the first-ever
  // connect and right after logout, neither of which is anything to alarm the user about.
  // Only a drop mid-session that's actively being retried is worth surfacing.
  const isReconnecting = socketStatus === "reconnecting"

  function handleOpenNotification(notification: Notification) {
    if (!notification.isRead) markRead.mutate(notification.id)
    onClose()
    closeMobileMenu()
    if (notification.link) router.push(notification.link)
  }

  function handleViewAll() {
    onClose()
    closeMobileMenu()
  }

  return {
    unreadCount,
    hasUnread,
    isReconnecting,
    isLoading: notificationsQuery.isLoading,
    notifications,
    onMarkAllRead: () => markAllRead.mutate(),
    markAllReadPending: markAllRead.isPending,
    handleOpenNotification,
    handleViewAll,
  }
}
