"use client"

import { useState } from "react"
import { CalendarDays, ShieldAlert, X } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { useTranslation } from "react-i18next"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import CustomSelect from "@/components/ui/custom-select"
import { useDateLocale, useWeekStartsOn } from "@/lib/i18n/date-locale"

/** Action groups the log can be narrowed to — prefixes of the API's SECURITY_AUDIT_ACTIONS. */
const CATEGORIES = [
  "",
  "auth.",
  "org.",
  "account.",
  "export.",
  "file.",
  "case.",
  "document.",
  "consultation.",
  "admin.",
] as const

export interface AuditLogFilterState {
  category: string
  failuresOnly: boolean
  range: DateRange | undefined
}

export const EMPTY_AUDIT_LOG_FILTERS: AuditLogFilterState = {
  category: "",
  failuresOnly: false,
  range: undefined,
}

function daysAgo(days: number): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

const PRESETS = [
  { key: "today", range: () => ({ from: daysAgo(0), to: daysAgo(0) }) },
  { key: "last7", range: () => ({ from: daysAgo(6), to: daysAgo(0) }) },
  { key: "last30", range: () => ({ from: daysAgo(29), to: daysAgo(0) }) },
] as const

const labelClass =
  "text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"

/** The audit log's filter bar: what kind of activity, which days, and whether to show only
 * refused attempts. A date range is picked on one calendar (or a preset) rather than two native
 * date inputs, which render differently in every browser. */
export function AuditLogFilters({
  value,
  onChange,
}: {
  value: AuditLogFilterState
  onChange: (next: AuditLogFilterState) => void
}) {
  const { t } = useTranslation("organization")
  const locale = useDateLocale()
  const weekStartsOn = useWeekStartsOn()
  const [dateOpen, setDateOpen] = useState(false)

  const formatDay = (date: Date) =>
    date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  const { range } = value
  const rangeLabel = range?.from
    ? range.to && range.to.getTime() !== range.from.getTime()
      ? `${formatDay(range.from)} – ${formatDay(range.to)}`
      : formatDay(range.from)
    : t("auditLog.allDates")

  const isFiltered =
    value.category !== "" || value.failuresOnly || range?.from !== undefined

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border px-6 py-4 md:px-8">
      <div className="flex w-full flex-col gap-1.5 sm:w-56">
        <label htmlFor="audit-log-activity" className={labelClass}>
          {t("auditLog.categoryLabel")}
        </label>
        <CustomSelect
          id="audit-log-activity"
          value={value.category}
          onChange={(category) => onChange({ ...value, category })}
          options={CATEGORIES.map((category) => ({
            value: category,
            label: t(
              `auditLog.categories.${category ? category.slice(0, -1) : "all"}`
            ),
          }))}
        />
      </div>

      <div className="flex w-full flex-col gap-1.5 sm:w-auto">
        <span className={labelClass}>{t("auditLog.dateLabel")}</span>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${t("auditLog.dateLabel")}: ${rangeLabel}`}
              className="flex w-full min-w-56 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-transparent px-3 py-3 text-left text-base transition-colors hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none data-[state=open]:border-primary sm:py-2 sm:text-sm"
            >
              <span
                className={
                  range?.from ? "text-foreground" : "text-muted-foreground"
                }
              >
                {rangeLabel}
              </span>
              <CalendarDays
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <div className="flex flex-col sm:flex-row">
              <div className="flex flex-row flex-wrap gap-1 border-b border-border p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      onChange({ ...value, range: preset.range() })
                      setDateOpen(false)
                    }}
                    className="cursor-pointer rounded-md px-2.5 py-1.5 text-left text-[12px] text-foreground transition-colors hover:bg-muted"
                  >
                    {t(`auditLog.presets.${preset.key}`)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...value, range: undefined })
                    setDateOpen(false)
                  }}
                  className="cursor-pointer rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-muted"
                >
                  {t("auditLog.allDates")}
                </button>
              </div>
              <Calendar
                mode="range"
                selected={range}
                defaultMonth={range?.from}
                onSelect={(next) => onChange({ ...value, range: next })}
                disabled={{ after: new Date() }}
                weekStartsOn={weekStartsOn}
                className="p-2 [--cell-size:--spacing(8)]"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <button
        type="button"
        aria-pressed={value.failuresOnly}
        onClick={() =>
          onChange({ ...value, failuresOnly: !value.failuresOnly })
        }
        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-base transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none sm:py-2 sm:text-sm ${
          value.failuresOnly
            ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
            : "border-border text-foreground hover:border-foreground/30"
        }`}
      >
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("auditLog.failuresOnly")}
      </button>

      {isFiltered && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_AUDIT_LOG_FILTERS)}
          className="flex cursor-pointer items-center gap-1 rounded-md px-1 py-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none sm:ml-auto"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {t("auditLog.clearFilters")}
        </button>
      )}
    </div>
  )
}
