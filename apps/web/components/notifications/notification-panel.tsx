"use client"
import { BellOff } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import type { Notification } from "@/lib/notifications/queries"
import { NotificationItem } from "./notification-item"

interface NotificationPanelProps {
  isReconnecting: boolean
  hasUnread: boolean
  isLoading: boolean
  notifications: Notification[]
  onMarkAllRead: () => void
  markAllReadPending: boolean
  onOpenNotification: (notification: Notification) => void
  onViewAll: () => void
  /** Popover usage wants a fixed pixel width + its own scroll cap; the inline drawer usage
   * just fills whatever space its parent gives it — kept as a plain className hook rather
   * than baking either assumption in here. */
  className?: string
}

/** The notification list's actual content — header (title + mark-all-read), the scrollable
 * list itself, and the "view all" footer. Shared between NotificationBell's desktop popover
 * and GlobalHeader's mobile drawer, which swaps the primary nav list for this in place
 * instead of opening it as a floating popover (see GlobalHeader for why: a floating popover
 * inside the narrow drawer kept fighting Radix's own collision math). */
export function NotificationPanel({
  isReconnecting,
  hasUnread,
  isLoading,
  notifications,
  onMarkAllRead,
  markAllReadPending,
  onOpenNotification,
  onViewAll,
  className = "",
}: NotificationPanelProps) {
  const { t } = useTranslation("common")

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3.5 py-2.5">
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
            onClick={onMarkAllRead}
            disabled={markAllReadPending}
            className="text-[10px] font-medium uppercase tracking-wide text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {isLoading ? (
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
              <NotificationItem key={notification.id} notification={notification} onOpen={onOpenNotification} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-1.5">
        <Link
          href="/homepage/notifications"
          onClick={onViewAll}
          className="block rounded-lg px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-foreground/5"
        >
          {t("notifications.viewAll")}
        </Link>
      </div>
    </div>
  )
}
