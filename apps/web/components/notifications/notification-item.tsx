"use client"
import { AlertTriangle, Briefcase, CalendarClock } from "lucide-react"
import type { Notification, NotificationType } from "@/lib/notifications/queries"
import { formatRelativeTime } from "@/lib/notifications/format"

const TYPE_ICON: Record<NotificationType, typeof CalendarClock> = {
  EVENT_REMINDER: CalendarClock,
  CASE_UPDATE: Briefcase,
  SYSTEM: AlertTriangle,
}

interface NotificationItemProps {
  notification: Notification
  onOpen: (notification: Notification) => void
  dense?: boolean
}

export function NotificationItem({ notification, onOpen, dense = true }: NotificationItemProps) {
  const Icon = TYPE_ICON[notification.type] ?? AlertTriangle

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`flex w-full items-start gap-3 rounded-lg text-left transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 ${
        dense ? "px-2.5 py-2.5" : "px-4 py-3.5"
      } ${notification.isRead ? "" : "bg-primary/5"}`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          notification.isRead ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
        }`}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`truncate text-xs ${notification.isRead ? "font-medium text-foreground/80" : "font-semibold text-foreground"}`}>
            {notification.title}
          </span>
          {!notification.isRead && (
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          )}
        </span>
        <span className={`mt-0.5 block text-[11px] text-muted-foreground ${dense ? "line-clamp-2" : ""}`}>{notification.message}</span>
        <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
    </button>
  )
}
