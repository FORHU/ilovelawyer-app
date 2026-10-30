"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Landmark } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading"
import { ErrorState } from "@/components/error-state"
import { Pagination } from "@/components/ui/pagination"
import { useDateLocale } from "@/lib/i18n/date-locale"
import { formatMoney } from "@/lib/money"
import type { EarningStatus, WithdrawalStatus } from "@/lib/client-handoff"
import { OWN_WORKSPACE_ID } from "@/lib/store/auth.store"
import {
  WALLET_PAGE_SIZE,
  useRefreshPayoutAccountMutation,
  useStartPayoutOnboardingMutation,
  useWalletEarningsQuery,
  useWalletQuery,
  useWalletWithdrawalsQuery,
  useWithdrawMutation,
} from "@/lib/organizations/wallet"

/** The query parameter Stripe's onboarding comes back with, so the page reads the account again. */
const PAYOUTS_RETURN = "payouts"

const EARNING_TONE: Record<EarningStatus, "neutral" | "success" | "danger"> = { PENDING: "neutral", AVAILABLE: "success", REVERSED: "danger" }
const WITHDRAWAL_TONE: Record<WithdrawalStatus, "neutral" | "success" | "danger" | "caution"> = {
  REQUESTED: "neutral",
  PROCESSING: "caution",
  PAID: "success",
  FAILED: "danger",
  REJECTED: "danger",
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col gap-1 rounded-2xl border border-border bg-background px-4 py-3">
      <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">{label}</span>
      <span className="font-display text-[22px] text-foreground tabular-nums">{value}</span>
      {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
    </div>
  )
}

/**
 * The payee's earnings from client quotations (ilovelawyer-api's WalletSvc): each client payment
 * puts the lawyer's full fee in PENDING for the tenant's hold, then it becomes available to withdraw
 * to the bank through Stripe Connect. Owners and Admins only for a firm, same as the API's
 * requireOrgRole(ADMIN); with OWN_WORKSPACE_ID it's a solo lawyer's own, on their profile.
 */
export function WalletSection({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation("organization")
  const locale = useDateLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const solo = organizationId === OWN_WORKSPACE_ID

  const wallet = useWalletQuery(organizationId)
  const [earningsPage, setEarningsPage] = useState(1)
  const [withdrawalsPage, setWithdrawalsPage] = useState(1)
  const earnings = useWalletEarningsQuery(organizationId, earningsPage)
  const withdrawals = useWalletWithdrawalsQuery(organizationId, withdrawalsPage)
  const onboarding = useStartPayoutOnboardingMutation(organizationId)
  const refresh = useRefreshPayoutAccountMutation(organizationId)
  const withdraw = useWithdrawMutation(organizationId)
  const showSkeleton = useDelayedLoading(wallet.isLoading)

  const [amount, setAmount] = useState("")
  const [amountError, setAmountError] = useState("")
  // One key per withdrawal the lawyer means to make: kept across a retry of the same request, new
  // once it has gone through.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  // Back from Stripe's onboarding pages: read the account again, then drop the marker from the URL.
  const returned = searchParams.get(PAYOUTS_RETURN) === "return"
  const { mutate: refreshAccount } = refresh
  useEffect(() => {
    if (!returned) return
    refreshAccount()
    const params = new URLSearchParams(searchParams.toString())
    params.delete(PAYOUTS_RETURN)
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname)
  }, [returned, refreshAccount, searchParams, router, pathname])

  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })

  function setUpPayouts() {
    const returnUrl = `${window.location.origin}${pathname}?${PAYOUTS_RETURN}=return`
    onboarding.mutate(returnUrl, {
      onSuccess: (result) => {
        if (result.url) window.location.assign(result.url)
        else toast.success(t("wallet.payouts.ready"))
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : t("wallet.error")),
    })
  }

  function submitWithdrawal(e: React.FormEvent) {
    e.preventDefault()
    const data = wallet.data
    if (!data) return
    const value = Number(amount)
    const amountMinor = Math.round(value * 100)
    if (!Number.isFinite(value) || amountMinor <= 0) return setAmountError(t("wallet.withdraw.invalid"))
    if (amountMinor < data.minWithdrawal.amountMinor) return setAmountError(t("wallet.withdraw.belowMinimum", { min: formatMoney(data.minWithdrawal.amountMinor) }))
    if (amountMinor > data.balances.available.amountMinor) return setAmountError(t("wallet.withdraw.tooMuch", { available: formatMoney(data.balances.available.amountMinor) }))
    withdraw.mutate(
      { amountMinor, idempotencyKey },
      {
        onSuccess: (result) => {
          setAmount("")
          setIdempotencyKey(crypto.randomUUID())
          if (result.status === "FAILED") toast.error(result.failureReason ?? t("wallet.withdraw.failed"))
          else toast.success(result.status === "PAID" ? t("wallet.withdraw.paid") : t("wallet.withdraw.processing"))
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : t("wallet.error")),
      }
    )
  }

  const data = wallet.data
  const account = data?.payoutAccount
  const earningRows = earnings.data?.data ?? []
  const withdrawalRows = withdrawals.data?.data ?? []
  const pageLabels = { previous: t("auditLog.previous"), next: t("auditLog.next") }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl ring-1 shadow-black/20 ring-black/5 dark:ring-white/[0.06]">
      <div className="border-b border-border px-6 py-5 md:px-8">
        <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("wallet.heading")}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{t(solo ? "wallet.subheadingSolo" : "wallet.subheading")}</p>
      </div>

      {showSkeleton ? (
        <div className="flex flex-col gap-3 px-6 py-5 md:px-8">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-9 w-64" />
        </div>
      ) : wallet.isError || !data ? (
        <div className="px-6 py-5 md:px-8">
          <ErrorState message={t("wallet.error")} retryLabel={t("wallet.retry")} onRetry={() => wallet.refetch()} />
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-6 py-5 md:px-8">
          <div className="flex flex-wrap gap-3">
            <Tile label={t("wallet.balances.available")} value={formatMoney(data.balances.available.amountMinor)} />
            <Tile
              label={t("wallet.balances.pending")}
              value={formatMoney(data.balances.pending.amountMinor)}
              note={data.earningsHoldDays !== null ? t("wallet.balances.pendingNote", { days: data.earningsHoldDays }) : undefined}
            />
            <Tile label={t("wallet.balances.reserved")} value={formatMoney(data.balances.reserved.amountMinor)} />
            <Tile label={t("wallet.balances.withdrawn")} value={formatMoney(data.balances.withdrawn.amountMinor)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
            <div className="flex items-center gap-3">
              <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-[13px] text-foreground">
                {account?.payoutsEnabled ? t("wallet.payouts.enabled") : account?.connected ? t("wallet.payouts.unfinished") : t("wallet.payouts.none")}
              </p>
            </div>
            {!account?.payoutsEnabled && (
              <Button type="button" variant="accent" isPending={onboarding.isPending} onClick={setUpPayouts}>
                {account?.connected ? t("wallet.payouts.finish") : t("wallet.payouts.setUp")}
              </Button>
            )}
            {account?.payoutsEnabled && account.provider === "STRIPE" && (
              <Button type="button" variant="outline" isPending={onboarding.isPending} onClick={setUpPayouts}>
                {t("wallet.payouts.update")}
              </Button>
            )}
          </div>

          <form onSubmit={submitWithdrawal} noValidate className="flex flex-col gap-1.5">
            <label htmlFor="wallet-withdraw-amount" className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
              {t("wallet.withdraw.label")}
            </label>
            <div className="flex flex-wrap gap-2">
              <div className={`flex min-w-[200px] flex-1 items-center gap-2 rounded-full border bg-background px-4 focus-within:border-foreground ${amountError ? "border-red-500" : "border-border"}`}>
                <span className="text-sm text-muted-foreground" aria-hidden="true">
                  £
                </span>
                <input
                  id="wallet-withdraw-amount"
                  inputMode="decimal"
                  value={amount}
                  placeholder="0.00"
                  aria-invalid={!!amountError}
                  aria-describedby="wallet-withdraw-hint"
                  disabled={!account?.payoutsEnabled}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/[^\d.]/g, ""))
                    setAmountError("")
                  }}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none tabular-nums"
                />
              </div>
              <Button type="submit" variant="accent" isPending={withdraw.isPending} disabled={!account?.payoutsEnabled || data.balances.available.amountMinor <= 0}>
                {t("wallet.withdraw.submit")}
              </Button>
            </div>
            <p id="wallet-withdraw-hint" className={`text-xs ${amountError ? "text-red-600" : "text-muted-foreground"}`}>
              {amountError || (account?.payoutsEnabled ? t("wallet.withdraw.hint", { min: formatMoney(data.minWithdrawal.amountMinor) }) : t("wallet.withdraw.needsPayouts"))}
            </p>
          </form>

          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">{t("wallet.earnings.heading")}</h3>
            {earningRows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{t("wallet.earnings.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">{t("wallet.earnings.date")}</th>
                      <th className="py-2 pr-3 font-semibold">{t("wallet.earnings.clientPaid")}</th>
                      <th className="py-2 pr-3 font-semibold">{t("wallet.earnings.yours")}</th>
                      <th className="py-2 pr-3 font-semibold">{t("wallet.earnings.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningRows.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="py-2 pr-3 text-muted-foreground">{date(e.createdAt)}</td>
                        <td className="py-2 pr-3 tabular-nums">{formatMoney(e.gross.amountMinor)}</td>
                        <td className="py-2 pr-3 tabular-nums font-semibold">
                          {formatMoney(e.net.amountMinor - e.reversed.amountMinor)}
                          {e.reversed.amountMinor > 0 && <span className="ml-1 font-normal text-muted-foreground">{t("wallet.earnings.refunded", { amount: formatMoney(e.reversed.amountMinor) })}</span>}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge tone={EARNING_TONE[e.status]} shape="pill">
                            {e.disputed ? t("wallet.earnings.disputed") : t(`wallet.earnings.statuses.${e.status}`)}
                          </Badge>
                          {e.status === "PENDING" && !e.disputed && <span className="ml-2 text-[11px] text-muted-foreground">{t("wallet.earnings.availableOn", { date: date(e.availableAt) })}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={earningsPage} totalPages={Math.ceil((earnings.data?.total ?? 0) / WALLET_PAGE_SIZE)} onPageChange={setEarningsPage} labels={pageLabels} />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">{t("wallet.withdrawals.heading")}</h3>
            {withdrawalRows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{t("wallet.withdrawals.empty")}</p>
            ) : (
              <ul className="flex flex-col">
                {withdrawalRows.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-[13px]">
                    <span className="text-muted-foreground">{date(w.createdAt)}</span>
                    <span className="tabular-nums font-semibold">{formatMoney(w.amount.amountMinor)}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={WITHDRAWAL_TONE[w.status]} shape="pill">
                        {t(`wallet.withdrawals.statuses.${w.status}`)}
                      </Badge>
                      {w.failureReason && <span className="text-[11px] text-muted-foreground">{w.failureReason}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={withdrawalsPage} totalPages={Math.ceil((withdrawals.data?.total ?? 0) / WALLET_PAGE_SIZE)} onPageChange={setWithdrawalsPage} labels={pageLabels} />
          </div>
        </div>
      )}
    </section>
  )
}
