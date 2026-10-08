"use client"

import { useMemo, useState } from "react"
import { Download, Loader2, ShieldAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading"
import { ErrorState } from "@/components/error-state"
import { useDateLocale } from "@/lib/i18n/date-locale"
import { useOrganizationMembersQuery } from "@/lib/organizations/queries"
import {
  downloadOrganizationAuditLog,
  useOrganizationAuditLogQuery,
  type AuditLogFilters,
  type SecurityAuditEventRecord,
} from "@/lib/organizations/audit-log"

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

/** A YYYY-MM-DD from <input type="date">, as the start of that local day in ISO. */
function startOfDayIso(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString()
}

function startOfNextDayIso(day: string): string {
  const date = new Date(`${day}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return date.toISOString()
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}

/** "method: password · reason: Invalid email or password" — payloads are small and flat. */
function payloadSummary(payload: SecurityAuditEventRecord["payload"]): string {
  if (!payload) return ""
  return Object.entries(payload)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== ""
    )
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`
    )
    .join(" · ")
}

const selectClass =
  "cursor-pointer rounded-full border border-border bg-foreground/5 px-3 py-1.5 text-[12px] text-foreground outline-none transition-colors hover:border-brand-gold/50 focus-visible:ring-2 focus-visible:ring-brand-gold/30 [color-scheme:light] dark:[color-scheme:dark]"

/** The organization's security audit log (ilovelawyer-api docs/adr/0006-security-audit-log.md):
 * sign-ins, membership and permission changes, exports, downloads and deletions. Owners and
 * Admins only — the page renders this for them, and the API refuses anyone else. */
export function AuditLogSection({
  organizationId,
}: {
  organizationId: string
}) {
  const { t } = useTranslation("organization")
  const locale = useDateLocale()
  const [category, setCategory] = useState<string>("")
  const [failuresOnly, setFailuresOnly] = useState(false)
  const [fromDay, setFromDay] = useState("")
  const [toDay, setToDay] = useState("")
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const filters = useMemo<AuditLogFilters>(
    () => ({
      action: category || undefined,
      outcome: failuresOnly ? "FAILURE" : undefined,
      from: fromDay ? startOfDayIso(fromDay) : undefined,
      to: toDay ? startOfNextDayIso(toDay) : undefined,
    }),
    [category, failuresOnly, fromDay, toDay]
  )

  const query = useOrganizationAuditLogQuery(organizationId, filters)
  const showSkeleton = useDelayedLoading(query.isLoading)
  const events = query.data?.pages.flatMap((page) => page.events) ?? []

  // Names members instead of bare ids; anyone no longer in the organization keeps the email the
  // row snapshotted (actor) or a short id (target).
  const membersQuery = useOrganizationMembersQuery(organizationId)
  const memberNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const member of membersQuery.data ?? []) {
      names.set(member.userId, member.user.name ?? member.user.email)
    }
    return names
  }, [membersQuery.data])

  function actorLabel(event: SecurityAuditEventRecord): string {
    if (event.actorId)
      return (
        memberNames.get(event.actorId) ??
        event.actorEmail ??
        shortId(event.actorId)
      )
    return t("auditLog.noActor")
  }

  function targetLabel(event: SecurityAuditEventRecord): string | null {
    if (!event.targetType) return null
    const type = t(`auditLog.targets.${event.targetType}`, {
      defaultValue: event.targetType,
    })
    if (!event.targetId) return type
    const name =
      event.targetType === "user" ? memberNames.get(event.targetId) : undefined
    return `${type} · ${name ?? shortId(event.targetId)}`
  }

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      await downloadOrganizationAuditLog(organizationId, filters)
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : t("auditLog.exportError")
      )
    } finally {
      setExporting(false)
    }
  }

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
          onClick={handleExport}
          disabled={exporting}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-[11px] font-semibold tracking-wider text-foreground uppercase transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {exporting ? t("auditLog.exporting") : t("auditLog.export")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4 md:px-8">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label={t("auditLog.categoryLabel")}
          className={selectClass}
        >
          {CATEGORIES.map((value) => (
            <option key={value || "all"} value={value} className="text-black">
              {t(`auditLog.categories.${value ? value.slice(0, -1) : "all"}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[12px] text-foreground">
          <span className="text-muted-foreground">{t("auditLog.from")}</span>
          <input
            type="date"
            value={fromDay}
            max={toDay || undefined}
            onChange={(e) => setFromDay(e.target.value)}
            className={selectClass}
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-foreground">
          <span className="text-muted-foreground">{t("auditLog.to")}</span>
          <input
            type="date"
            value={toDay}
            min={fromDay || undefined}
            onChange={(e) => setToDay(e.target.value)}
            className={selectClass}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-foreground">
          <input
            type="checkbox"
            checked={failuresOnly}
            onChange={(e) => setFailuresOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-current"
          />
          {t("auditLog.failuresOnly")}
        </label>
      </div>

      {exportError && (
        <p className="px-6 pt-4 text-[12px] text-red-600 md:px-8 dark:text-red-400">
          {exportError}
        </p>
      )}

      {showSkeleton ? (
        <div className="flex flex-col gap-3 px-6 py-5 md:px-8">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
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
        <ol className="flex flex-col divide-y divide-border">
          {events.map((event) => {
            const target = targetLabel(event)
            const details = [
              event.caseId
                ? `${t("auditLog.case")} ${shortId(event.caseId)}`
                : null,
              payloadSummary(event.payload) || null,
              event.ip ? `IP ${event.ip}` : null,
            ].filter(Boolean)
            return (
              <li
                key={event.id}
                className="flex gap-4 px-6 py-3.5 md:px-8"
                title={
                  event.requestId ? `Request ${event.requestId}` : undefined
                }
              >
                <time
                  dateTime={event.createdAt}
                  className="w-36 shrink-0 pt-0.5 text-[12px] text-muted-foreground tabular-nums"
                >
                  {new Date(event.createdAt).toLocaleString(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] text-foreground">
                    <span>
                      {t(`auditLog.actions.${event.action}`, {
                        defaultValue: event.action,
                      })}
                    </span>
                    {event.outcome === "FAILURE" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-red-600 uppercase dark:text-red-400">
                        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                        {t("auditLog.failed")}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {actorLabel(event)}
                    {target ? ` → ${target}` : ""}
                  </p>
                  {details.length > 0 && (
                    <p className="truncate text-[11px] text-muted-foreground/80">
                      {details.join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {query.hasNextPage && (
        <div className="border-t border-border px-6 py-4 text-center md:px-8">
          <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="cursor-pointer rounded-full border border-border px-5 py-2 text-[11px] font-semibold tracking-wider text-foreground uppercase transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {query.isFetchingNextPage
              ? t("auditLog.loading")
              : t("auditLog.loadMore")}
          </button>
        </div>
      )}
    </section>
  )
}
