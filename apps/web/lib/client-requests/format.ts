import { dateLocale } from "@/lib/i18n/date-locale"

/** "2 hours ago", "1 day ago" in the tenant's locale. */
export function formatTimeAgo(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat(dateLocale(), { numeric: "always" })
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return rtf.format(-minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(-hours, "hour")
  return rtf.format(-Math.round(hours / 24), "day")
}
