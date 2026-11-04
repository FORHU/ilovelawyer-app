"use client"

import { useState } from "react"
import { Printer, ReceiptText } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import type { QuotationInvoice } from "@/lib/client-handoff"
import { useEngagementInvoiceQuery } from "@/lib/client-requests/invoice"
import { useDateLocale } from "@/lib/i18n/date-locale"
import { formatMoney } from "@/lib/money"

const LABEL = "text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground"

const STATUS_TONE: Record<QuotationInvoice["status"], "success" | "caution" | "danger"> = {
  PAID: "success",
  PARTIALLY_REFUNDED: "caution",
  REFUNDED: "danger",
  DISPUTED: "danger",
}

function Line({ label, note, amount, strong }: { label: string; note?: string; amount: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2.5", strong && "text-[15px] font-semibold")}>
      <div className="min-w-0">
        <div className="text-foreground">{label}</div>
        {note && <div className="mt-0.5 line-clamp-3 text-[12px] whitespace-pre-line text-muted-foreground print:line-clamp-none">{note}</div>}
      </div>
      <div className="shrink-0 text-foreground tabular-nums">{amount}</div>
    </div>
  )
}

/** The invoice itself, as the dialog shows and prints it. */
function InvoiceDocument({ invoice }: { invoice: QuotationInvoice }) {
  const { t } = useTranslation("client-request")
  const locale = useDateLocale()
  const issued = new Date(invoice.issuedAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
  const netPaid = invoice.total.amountMinor - invoice.refunded.amountMinor
  const yourFee = invoice.serviceFee.amountMinor - invoice.lawyerRefunded.amountMinor

  return (
    <div className="flex flex-col gap-5 text-[13px]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <div className={LABEL}>{t("invoice.from")}</div>
          <div className="mt-1 font-semibold text-foreground">{invoice.payee.name}</div>
          {invoice.payee.lawyerName && invoice.payee.lawyerName !== invoice.payee.name && <div className="text-muted-foreground">{invoice.payee.lawyerName}</div>}
        </div>
        <div>
          <div className={LABEL}>{t("invoice.billedTo")}</div>
          <div className="mt-1 font-semibold text-foreground">{invoice.client.name}</div>
        </div>
        <div>
          <div className={LABEL}>{t("invoice.issued")}</div>
          <div className="mt-1 text-foreground">{issued}</div>
        </div>
      </div>

      <div>
        <div className={LABEL}>{t("invoice.matter")}</div>
        <div className="mt-1 text-foreground">{invoice.caseName}</div>
      </div>

      <div className="divide-y divide-border border-y border-border">
        <Line
          label={invoice.quoteType === "FIRST_CONSULTATION" ? t("detail.quote.consultation") : t("detail.quote.fixed")}
          note={invoice.description || undefined}
          amount={formatMoney(invoice.total.amountMinor)}
        />
        <Line label={t("invoice.total")} amount={formatMoney(invoice.total.amountMinor)} strong />
        {invoice.refunded.amountMinor > 0 && (
          <>
            <Line label={t("invoice.refunded")} amount={`−${formatMoney(invoice.refunded.amountMinor)}`} />
            <Line label={t("invoice.netPaid")} amount={formatMoney(netPaid)} strong />
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3 print:border print:border-border">
        <div>
          <div className="font-semibold text-foreground">{t("invoice.yourFee")}</div>
          <div className="text-[12px] text-muted-foreground">{t("invoice.yourFeeNote", { fee: formatMoney(invoice.platformFee.amountMinor) })}</div>
        </div>
        <div className="text-[15px] font-semibold text-foreground tabular-nums">{formatMoney(yourFee)}</div>
      </div>

      <div className="flex flex-col gap-0.5 text-[12px] text-muted-foreground">
        <span>{invoice.payment.provider === "STRIPE" ? t("invoice.paidByStripe") : t("invoice.paidByTest")}</span>
        <span>
          {t("invoice.reference")} <span className="font-mono text-foreground">{invoice.payment.reference}</span>
        </span>
      </div>
    </div>
  )
}

/**
 * The client's payment for the lawyer's quote, as an invoice, right on the engaged (or closed)
 * request: a summary line, and the full invoice in a dialog the lawyer can print or save as a PDF.
 * Printing shows only the invoice (data-print-root, globals.css). Nothing shows when the client
 * paid nothing through ilovelawyer.
 */
export function EngagementInvoice({ requestId, className }: { requestId: string; className?: string }) {
  const { t } = useTranslation("client-request")
  const query = useEngagementInvoiceQuery(requestId)
  const [open, setOpen] = useState(false)
  const invoice = query.data?.invoice
  if (!invoice) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border px-4 py-3", className)}>
      <ReceiptText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-foreground">{t("invoice.title")}</div>
        <div className="text-[12px] text-muted-foreground tabular-nums">
          {invoice.number} · {t("invoice.clientPaid", { amount: formatMoney(invoice.total.amountMinor) })}
        </div>
      </div>
      <Badge tone={STATUS_TONE[invoice.status]} shape="pill">
        {t(`invoice.statuses.${invoice.status}`)}
      </Badge>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("invoice.view")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-print-root
          showCloseButton={false}
          overlayClassName="print:hidden"
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl print:static print:max-h-none print:max-w-none print:translate-x-0 print:translate-y-0 print:animate-none print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none print:[print-color-adjust:exact] print:[--border:#d4d4d4] print:[--card:#ffffff] print:[--card-foreground:#1a1a1a] print:[--foreground:#1a1a1a] print:[--muted:#f4f4f5] print:[--muted-foreground:#4a4a4a]"
        >
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DialogTitle className="font-['Libre_Caslon_Text',serif] text-[22px] font-normal">{t("invoice.title")}</DialogTitle>
              <Badge tone={STATUS_TONE[invoice.status]} shape="pill">
                {t(`invoice.statuses.${invoice.status}`)}
              </Badge>
            </div>
            <DialogDescription className="tabular-nums">{invoice.number}</DialogDescription>
          </DialogHeader>
          <InvoiceDocument invoice={invoice} />
          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("invoice.close")}
            </Button>
            <Button type="button" variant="accent" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              {t("invoice.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
