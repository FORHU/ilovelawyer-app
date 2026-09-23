"use client"
import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { useTranslation } from "react-i18next"
import { NotificationBellTrigger } from "./notification-bell-trigger"
import { NotificationPanel } from "./notification-panel"
import { useNotificationBellState } from "./use-notification-bell-state"

/** Desktop header's bell — a floating popover next to the account menu. The mobile drawer
 * doesn't use this at all anymore: it renders NotificationBellTrigger + NotificationPanel
 * itself, swapping the panel in for the primary nav list in place instead of opening a
 * popover (see GlobalHeader) — a floating popover inside that narrow panel kept fighting
 * Radix's own collision math trying to stay on-screen. */
export function NotificationBell() {
  const { t } = useTranslation("common")
  const [open, setOpen] = useState(false)
  const state = useNotificationBellState(open, () => setOpen(false))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <NotificationBellTrigger
              open={open}
              hasUnread={state.hasUnread}
              unreadCount={state.unreadCount}
              isReconnecting={state.isReconnecting}
              onClick={() => setOpen((prev) => !prev)}
            />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{state.isReconnecting ? t("notifications.reconnecting") : t("notifications.label")}</TooltipContent>
      </Tooltip>

      <PopoverContent
        // Radix picks whichever side (top/bottom) has more room and flips the popover to fit,
        // but that's a *position* choice, not a size one — content taller than the space it
        // flipped into still overflows past the screen edge and gets clipped. available-height
        // is the actual room Radix computed for the side it picked, so capping to it here —
        // with only the list scrolling internally, not this whole flex column — keeps the
        // header/footer always visible and never lets the popover itself run off-screen.
        className="flex max-h-(--radix-popover-content-available-height) w-80 flex-col overflow-hidden p-0"
        align="end"
      >
        <NotificationPanel
          isReconnecting={state.isReconnecting}
          hasUnread={state.hasUnread}
          isLoading={state.isLoading}
          notifications={state.notifications}
          onMarkAllRead={state.onMarkAllRead}
          markAllReadPending={state.markAllReadPending}
          onOpenNotification={state.handleOpenNotification}
          onViewAll={state.handleViewAll}
        />
      </PopoverContent>
    </Popover>
  )
}
