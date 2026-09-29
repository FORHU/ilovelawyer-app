/** Compact relative time ("5m ago", "2h ago", "3d ago") — date-fns's formatDistanceToNow
 * produces "5 minutes ago", too long for a dense notification list. Falls back to a short
 * date once it's more than a week old, since "12d ago" stops being useful at that point. */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.round(diffMs / 1000)

  if (diffSec < 60) return "Just now"

  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`

  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Event notifications are written server-side as "<title> — <date/time>", but the API formats
 * that time in the server's own timezone (UTC), not the lawyer's — e.g. a 12:00 PM Manila
 * appointment read "4:00 AM". The link carries the exact instant (`?date=<ISO>`), so re-render
 * the time part from it in the viewer's timezone. Anything that doesn't fit that shape (other
 * types, older links without a date) is shown as stored. */
export function formatNotificationMessage(notification: { type: string; message: string; link: string | null }): string {
  const { type, message, link } = notification
  if (type !== "EVENT_REMINDER" || !link) return message

  const separator = " — "
  const cut = message.lastIndexOf(separator)
  if (cut === -1) return message

  const iso = new URLSearchParams(link.split("?")[1] ?? "").get("date")
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return message

  return `${message.slice(0, cut)}${separator}${date.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}`
}
