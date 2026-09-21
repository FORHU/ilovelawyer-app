"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, BellOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  useNotificationsQuery,
  useUnreadCountQuery,
  useNotificationSocketStatus,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  type Notification,
} from "@/lib/notifications/queries"
import { NotificationItem } from "./notification-item"

const POPOVER_LIST_LIMIT = 8

export function NotificationBell() {
  const { t } = useTranslation("common")
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const unreadCountQuery = useUnreadCountQuery()
  // Only fetches the list once the popover has actually been opened — no point paying for it
  // on every page load just to render a badge number, which unreadCountQuery already covers.
  const notificationsQuery = useNotificationsQuery({ limit: POPOVER_LIST_LIMIT, enabled: open })
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
    setOpen(false)
    if (notification.link) router.push(notification.link)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`relative flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                open ? "border-foreground" : ""
              }`}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={
                isReconnecting
                  ? t("notifications.reconnecting")
                  : hasUnread
                    ? t("notifications.unreadCount", { count: unreadCount })
                    : t("notifications.label")
              }
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              {hasUnread && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {/* Opposite corner from the unread badge so the two never collide — subtle by
                  design: a small pulsing dot, not a banner, since a reconnect is usually
                  seconds away and not something worth interrupting the user over. */}
              {isReconnecting && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400 ring-1 ring-background"
                />
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{isReconnecting ? t("notifications.reconnecting") : t("notifications.label")}</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground">{t("notifications.label")}</span>
            {isReconnecting && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500">
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                {t("notifications.reconnecting")}
              </span>
            )}
          </span>
          {hasUnread && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-[10px] font-medium uppercase tracking-wide text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
            >
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto p-1.5">
          {notificationsQuery.isLoading ? (
            <div className="px-3 py-8 text-center text-[11px] text-muted-foreground">…</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-xs font-medium text-foreground">{t("notifications.empty")}</p>
              <p className="text-[11px] text-muted-foreground">{t("notifications.emptyDescription")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onOpen={handleOpenNotification} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-1.5">
          <Link
            href="/homepage/notifications"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-foreground/5"
          >
            {t("notifications.viewAll")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
