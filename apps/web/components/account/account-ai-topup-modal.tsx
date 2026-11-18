"use client"

import { useMemo, useState } from "react"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { getTenantCodeConfig } from "@/config/tenant-codes"
import { useAccountTopUpQuoteQuery, useAccountTopUpStatusQuery, useAccountTopUpTermsQuery, useStartAccountTopUpMutation } from "@/lib/account/ai-allowance"
import { currencyDecimals, formatAmount } from "@/lib/money"
import { useAuthStore } from "@/lib/store/auth.store"

/**
 * Amount selector -> live fee/total preview (AccountTopUpBillingSvc.quote, "like OpenAI credits") ->
 * Stripe's embedded checkout -> polled status (useAccountTopUpStatusQuery), until the account
 * unlocks. Never shows the account's underlying AI allowance ceiling — only the amount the lawyer
 * themselves picks here and the platform fee on it. Everything is in the site's currency, from the
 * API's terms: dollars on PH and UK, whole won on KR.
 */
export function AccountAiTopUpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("case-portfolio")
  const terms = useAccountTopUpTermsQuery(open).data
  const locale = getTenantCodeConfig(useAuthStore((s) => s.organization?.tenantCode)).locale
  const money = (amount: number) => (terms ? formatAmount(amount, terms.currency, { locale, cents: true }) : "")
  // The middle preset until the lawyer picks one: $20, or ₩30,000 on KR.
  const defaultAmount = terms ? String(terms.presets[Math.floor(terms.presets.length / 2)]) : ""
  const [typedAmount, setAmountInput] = useState<string | null>(null)
  const amountInput = typedAmount ?? defaultAmount
  const [topUpId, setTopUpId] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<{ clientSecret: string; publishableKey: string } | null>(null)

  const amount = Number(amountInput)
  const decimals = terms ? currencyDecimals(terms.currency) : 2
  const amountValid =
    !!terms &&
    amountInput.trim() !== "" &&
    Number.isFinite(amount) &&
    // No more decimals than the currency has: no part of a won.
    Math.abs(amount * 10 ** decimals - Math.round(amount * 10 ** decimals)) < 1e-6 &&
    amount >= terms.minAmount &&
    amount <= terms.maxAmount

  const quote = useAccountTopUpQuoteQuery(amountValid ? amount : null)
  const start = useStartAccountTopUpMutation()
  const status = useAccountTopUpStatusQuery(topUpId)

  // Deliberately keyed on publishableKey alone, not the whole checkout object — loadStripe only
  // needs to re-run if the key itself changes, never for a new clientSecret on the same key.
  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (checkout ? loadStripe(checkout.publishableKey) : null),
    [checkout?.publishableKey] // eslint-disable-line react-hooks/exhaustive-deps
  )

  function reset() {
    setAmountInput(null)
    setTopUpId(null)
    setCheckout(null)
    start.reset()
  }

  function handleClose() {
    reset()
    onClose()
  }

  function startPayment() {
    if (!amountValid) return
    start.mutate(amount, {
      onSuccess: (result) => {
        setTopUpId(result.topUpId)
        if (result.checkout) setCheckout({ clientSecret: result.checkout.clientSecret, publishableKey: result.checkout.publishableKey })
      },
    })
  }

  const succeeded = status.data?.status === "SUCCEEDED"
  const failed = status.data?.status === "FAILED" || status.data?.status === "EXPIRED"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("aiAllowance.topUpTitle")}</DialogTitle>
          <DialogDescription>{t("aiAllowance.topUpDescription")}</DialogDescription>
        </DialogHeader>

        {succeeded ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-green-600" />
            <p className="font-medium">{t("aiAllowance.topUpSuccess")}</p>
            <Button onClick={handleClose}>{t("aiAllowance.topUpDone")}</Button>
          </div>
        ) : checkout ? (
          <div className="flex flex-col gap-3">
            {failed ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-destructive">{status.data?.failureReason ?? t("aiAllowance.topUpFailed")}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTopUpId(null)
                    setCheckout(null)
                  }}
                >
                  {t("aiAllowance.topUpTryAgain")}
                </Button>
              </div>
            ) : (
              stripePromise && (
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: checkout.clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              {(terms?.presets ?? []).map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={amountInput === String(preset) ? "default" : "outline"}
                  onClick={() => setAmountInput(String(preset))}
                >
                  {formatAmount(preset, terms!.currency, { locale })}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="account-ai-topup-amount" className="text-sm font-medium">
                {t("aiAllowance.topUpAmountLabel", { currency: terms?.currency ?? "" })}
              </label>
              <input
                id="account-ai-topup-amount"
                type="number"
                min={terms?.minAmount}
                max={terms?.maxAmount}
                step={decimals === 0 ? "1000" : "1"}
                inputMode={decimals === 0 ? "numeric" : "decimal"}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
              {!amountValid && amountInput.trim() !== "" && <p className="text-xs text-destructive">{t("aiAllowance.topUpAmountRange", { min: formatAmount(terms?.minAmount ?? 0, terms?.currency ?? "USD", { locale }), max: formatAmount(terms?.maxAmount ?? 0, terms?.currency ?? "USD", { locale }) })}</p>}
            </div>

            {amountValid && quote.data && (
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("aiAllowance.topUpLineAmount")}</span>
                  <span>{money(quote.data.topUpAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("aiAllowance.topUpLineFee")}</span>
                  <span>{money(quote.data.feeAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 font-medium">
                  <span>{t("aiAllowance.topUpLineTotal")}</span>
                  <span>{money(quote.data.totalCharged)}</span>
                </div>
              </div>
            )}

            {start.isError && <p className="text-sm text-destructive">{(start.error as Error).message}</p>}

            <Button onClick={startPayment} disabled={!amountValid || !quote.data || start.isPending}>
              {start.isPending && <Loader2 className="size-3.5 animate-spin" />}
              {start.isPending ? t("aiAllowance.topUpStarting") : t("aiAllowance.topUpContinue")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
