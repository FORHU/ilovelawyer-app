"use client"
import { forwardRef } from "react"
import { Bell } from "lucide-react"
import { useTranslation } from "react-i18next"

interface NotificationBellTriggerProps {
  open: boolean
  hasUnread: boolean
  unreadCount: number
  isReconnecting: boolean
  onClick: () => void
}

/** The icon button itself (badge + reconnecting dot), with no opinion on what opens when it's
 * clicked — NotificationBell wraps it in a Popover for the desktop header; GlobalHeader's
 * mobile drawer uses it directly to toggle its own inline panel instead. forwardRef so
 * `PopoverTrigger asChild` (Radix's Slot) can still attach its own ref/props to this exact
 * button rather than a wrapper around it. */
export const NotificationBellTrigger = forwardRef<HTMLButtonElement, NotificationBellTriggerProps>(
  function NotificationBellTrigger({ open, hasUnread, unreadCount, isReconnecting, onClick }, ref) {
    const { t } = useTranslation("common")

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
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
        {/* Opposite corner from the unread badge so the two never collide — subtle by design:
            a small pulsing dot, not a banner, since a reconnect is usually seconds away and
            not something worth interrupting the user over. */}
        {isReconnecting && (
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400 ring-1 ring-background"
          />
        )}
      </button>
    )
  },
)
