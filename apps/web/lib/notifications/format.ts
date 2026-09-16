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
