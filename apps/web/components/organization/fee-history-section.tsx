"use client"

import { Fragment, useState } from "react"
import { ExternalLink, ShieldAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { ErrorState } from "@/components/error-state"
import { Pagination } from "@/components/ui/pagination"
import { useDateLocale } from "@/lib/i18n/date-locale"
import { formatMoney } from "@/lib/money"
import type { ChargeKind } from "@/lib/client-handoff"
import { FEE_HISTORY_PAGE_SIZE, useOrganizationFeesQuery, type ChargeRecord } from "@/lib/organizations/billing"
import { chargeStatusTone, groupChargesByMonth } from "@/lib/organizations/fee-history-format"

const KIND_FILTERS: { value: ChargeKind | ""; labelKey: string }[] = [
  { value: "", labelKey: "billing.kindFilter.all" },
  { value: "PER_CASE_FEE", labelKey: "billing.kindFilter.perCaseFee" },
  { value: "AI_TOP_UP", labelKey: "billing.kindFilter.aiTopUp" },
]

function description(charge: ChargeRecord, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const kindLabel = t(`billing.kindFilter.${charge.kind === "PER_CASE_FEE" ? "perCaseFee" : "aiTopUp"}`)
  return charge.lawyer ? `${kindLabel} — ${charge.lawyer.name}` : kindLabel
}

export function FeeHistorySection({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation("organization")
  const locale = useDateLocale()
  const [kind, setKind] = useState<ChargeKind | "">("")
  const [page, setPage] = useState(1)

  const query = useOrganizationFeesQuery(organizationId, { kind: kind || undefined }, page)
  const showSkeleton = useDelayedLoading(query.isLoading)
  const data = query.data
  const charges = data?.data ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / FEE_HISTORY_PAGE_SIZE)) : 1
  const monthGroups = groupChargesByMonth(charges)

  function changeKind(next: ChargeKind | "") {
    setKind(next)
    setPage(1)
  }

  const firstRow = data ? (page - 1) * FEE_HISTORY_PAGE_SIZE + 1 : 0
  const lastRow = data ? firstRow + charges.length - 1 : 0

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl ring-1 shadow-black/20 ring-black/5 dark:ring-white/[0.06]">
      <div className="border-b border-border px-6 py-5 md:px-8">
        <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("billing.heading")}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{t("billing.subheading")}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-6 py-4 md:px-8">
        {KIND_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={kind === filter.value}
            onClick={() => changeKind(filter.value)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
              kind === filter.value
                ? "border-brand-gold bg-brand-gold/10 text-amber-600 dark:text-brand-gold"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {t(filter.labelKey)}
          </button>
        ))}
      </div>

      {showSkeleton ? (
        <div className="flex flex-col gap-3 px-6 py-5 md:px-8">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={t("billing.error")} retryLabel={t("billing.retry")} onRetry={() => query.refetch()} />
      ) : charges.length === 0 ? (
        <p className="px-6 py-8 text-center text-[13px] text-muted-foreground md:px-8">
          {query.isLoading ? t("billing.loading") : kind ? t("billing.emptyFiltered") : t("billing.empty")}
        </p>
      ) : (
        <div className={`overflow-x-auto transition-opacity ${query.isPlaceholderData ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="bg-foreground/[0.03]">
              <tr className="border-b border-border">
                <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase first:pl-6 md:first:pl-8">
                  {t("billing.columns.date")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                  {t("billing.columns.description")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                  {t("billing.columns.amount")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                  {t("billing.columns.status")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase last:pr-6 md:last:pr-8">
                  {t("billing.columns.invoice")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthGroups.map((group) => (
                <Fragment key={group.key}>
                  <tr>
                    <td colSpan={5} className="bg-foreground/[0.02] px-6 py-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase md:px-8">
                      {group.monthStart.toLocaleDateString(locale, { month: "long", year: "numeric" })}
                    </td>
                  </tr>
                  {group.charges.map((charge) => (
                    <tr key={charge.id}>
                      <td className="px-3 py-3 align-top text-[12px] whitespace-nowrap text-muted-foreground tabular-nums first:pl-6 md:first:pl-8">
                        <time dateTime={charge.createdAt}>
                          {new Date(charge.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                        </time>
                      </td>
                      <td className="px-3 py-3 align-top text-[12px] text-foreground">
                        {description(charge, t)}
                        {charge.status === "FAILED" && charge.failureReason && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-1.5 inline-flex cursor-default items-center align-middle text-red-600 dark:text-red-400">
                                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{charge.failureReason}</TooltipContent>
                          </Tooltip>
                        )}
                        {charge.refunded.amountMinor > 0 && (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {t("billing.refunded", { amount: formatMoney(charge.refunded.amountMinor) })}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-[12px] font-semibold tabular-nums text-foreground">
                        {formatMoney(charge.amount.amountMinor)}
                      </td>
                      <td className="px-3 py-3 align-top text-[12px]">
                        <Badge shape="pill" tone={chargeStatusTone(charge.status)}>
                          {t(`billing.status.${charge.status}`)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 align-top text-[12px] last:pr-6 md:last:pr-8">
                        {charge.receiptUrl ? (
                          <a
                            href={charge.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:underline dark:text-brand-gold"
                          >
                            {t("billing.viewInvoice")}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{t("billing.noInvoice")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 md:px-8">
          <p className="text-[12px] text-muted-foreground tabular-nums">
            {t("billing.showing", { from: firstRow, to: lastRow, total: data.total })}
          </p>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            labels={{ previous: t("auditLog.previous"), next: t("auditLog.next"), last: t("auditLog.last") }}
          />
        </div>
      )}
    </section>
  )
}
