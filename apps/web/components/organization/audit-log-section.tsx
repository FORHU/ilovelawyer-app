"use client"

import { useMemo, useState } from "react"
import { FileDown, Loader2, ShieldAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading"
import { ErrorState } from "@/components/error-state"
import { Pagination } from "@/components/ui/pagination"
import {
  AuditLogFilters,
  EMPTY_AUDIT_LOG_FILTERS,
  type AuditLogFilterState,
} from "@/components/organization/audit-log-filters"
import { useDateLocale } from "@/lib/i18n/date-locale"
import {
  downloadOrganizationAuditLog,
  useOrganizationAuditLogQuery,
  type AuditLogFilters as AuditLogQueryFilters,
} from "@/lib/organizations/audit-log"

/** The start of `date`'s local day, in ISO. */
function startOfDayIso(date: Date): string {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day.toISOString()
}

/** The start of the local day after `date` — the API's `to` is exclusive. */
function startOfNextDayIso(date: Date): string {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() + 1)
  return day.toISOString()
}

const headerCellClass =
  "px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase first:pl-6 last:pr-6 md:first:pl-8 md:last:pr-8"

const cellClass =
  "px-3 py-3 align-top text-[12px] text-foreground first:pl-6 last:pr-6 md:first:pl-8 md:last:pr-8"

/** The organization's security audit log (ilovelawyer-api docs/adr/0006-security-audit-log.md):
 * sign-ins, membership and permission changes, exports, downloads and deletions, as a paged table
 * with a PDF download of whatever the filters show. Owners and Admins only — the page renders this
 * for them, and the API refuses anyone else. */
export function AuditLogSection({
  organizationId,
}: {
  organizationId: string
}) {
  const { t } = useTranslation("organization")
  const locale = useDateLocale()
  const [filterState, setFilterState] = useState<AuditLogFilterState>(
    EMPTY_AUDIT_LOG_FILTERS
  )
  const [page, setPage] = useState(1)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // One click on the calendar picks a single day; a second click extends it to a range.
  const filters = useMemo<AuditLogQueryFilters>(() => {
    const { category, failuresOnly, range } = filterState
    return {
      action: category || undefined,
      outcome: failuresOnly ? "FAILURE" : undefined,
      from: range?.from ? startOfDayIso(range.from) : undefined,
      to: range?.from ? startOfNextDayIso(range.to ?? range.from) : undefined,
    }
  }, [filterState])

  // Any filter change starts again from the first page.
  function changeFilters(next: AuditLogFilterState) {
    setFilterState(next)
    setPage(1)
  }

  const query = useOrganizationAuditLogQuery(organizationId, filters, page)
  const showSkeleton = useDelayedLoading(query.isLoading)
  const data = query.data
  const events = data?.events ?? []

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadOrganizationAuditLog(organizationId, filters)
      // The download is itself an audit row; show it.
      void query.refetch()
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : t("auditLog.downloadError")
      )
    } finally {
      setDownloading(false)
    }
  }

  const firstRow = data ? (data.page - 1) * data.pageSize + 1 : 0
  const lastRow = data ? firstRow + data.events.length - 1 : 0

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl ring-1 shadow-black/20 ring-black/5 dark:ring-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5 md:px-8">
        <div className="min-w-0">
          <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">
            {t("auditLog.heading")}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("auditLog.subheading")}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || !data?.total}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-[11px] font-semibold tracking-wider text-foreground uppercase transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {downloading ? t("auditLog.downloading") : t("auditLog.download")}
        </button>
      </div>

      <AuditLogFilters value={filterState} onChange={changeFilters} />

      {downloadError && (
        <p className="px-6 pt-4 text-[12px] text-red-600 md:px-8 dark:text-red-400">
          {downloadError}
        </p>
      )}

      {showSkeleton ? (
        <div className="flex flex-col gap-3 px-6 py-5 md:px-8">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          message={t("auditLog.error")}
          retryLabel={t("auditLog.retry")}
          onRetry={() => query.refetch()}
        />
      ) : events.length === 0 ? (
        <p className="px-6 py-8 text-center text-[13px] text-muted-foreground md:px-8">
          {query.isLoading ? t("auditLog.loading") : t("auditLog.empty")}
        </p>
      ) : (
        <div
          className={`overflow-x-auto transition-opacity ${query.isPlaceholderData ? "opacity-60" : ""}`}
        >
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="bg-foreground/[0.03]">
              <tr className="border-b border-border">
                <th scope="col" className={headerCellClass}>
                  {t("auditLog.columns.time")}
                </th>
                <th scope="col" className={headerCellClass}>
                  {t("auditLog.columns.action")}
                </th>
                <th scope="col" className={headerCellClass}>
                  {t("auditLog.columns.actor")}
                </th>
                <th scope="col" className={headerCellClass}>
                  {t("auditLog.columns.target")}
                </th>
                <th scope="col" className={headerCellClass}>
                  {t("auditLog.columns.details")}
                </th>
                <th scope="col" className={headerCellClass}>
                  {t("auditLog.columns.ip")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => {
                return (
                  <tr
                    key={event.id}
                    title={
                      event.requestId ? `Request ${event.requestId}` : undefined
                    }
                    className={
                      event.outcome === "FAILURE"
                        ? "bg-red-500/[0.04]"
                        : undefined
                    }
                  >
                    <td
                      className={`${cellClass} whitespace-nowrap text-muted-foreground tabular-nums`}
                    >
                      <time dateTime={event.createdAt}>
                        {new Date(event.createdAt).toLocaleString(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </td>
                    <td className={cellClass}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {t(`auditLog.actions.${event.action}`, {
                          defaultValue: event.action,
                        })}
                        {event.outcome === "FAILURE" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-red-600 uppercase dark:text-red-400">
                            <ShieldAlert
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            {t("auditLog.failed")}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={`${cellClass} max-w-[180px] break-words`}>
                      {event.display.actor}
                    </td>
                    <td
                      className={`${cellClass} max-w-[180px] break-words text-muted-foreground`}
                    >
                      {event.display.target}
                    </td>
                    <td
                      className={`${cellClass} max-w-[280px] break-words text-muted-foreground`}
                    >
                      {event.display.details}
                    </td>
                    <td
                      className={`${cellClass} whitespace-nowrap text-muted-foreground tabular-nums`}
                    >
                      {event.display.ip}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 md:px-8">
          <p className="text-[12px] text-muted-foreground tabular-nums">
            {t("auditLog.showing", {
              from: firstRow,
              to: lastRow,
              total: data.total,
            })}
          </p>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={setPage}
            labels={{
              previous: t("auditLog.previous"),
              next: t("auditLog.next"),
              last: t("auditLog.last"),
            }}
          />
        </div>
      )}
    </section>
  )
}
