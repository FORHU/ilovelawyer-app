"use client";

import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { useChangePlanMutation, usePlanChangePreviewQuery, type PaymentPlan } from "@/lib/account/payment-plans";

function formatMoney(amount: number, currency: string): string {
  return amount.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Confirming a change to a lawyer's paid plan (ilovelawyer-api's PaymentPlanBillingSvc.changePlan),
 * with what it does first, from the API's preview: an upgrade says what's charged to their saved card
 * now and that the new limits start at once; a downgrade, the day it happens and that nothing is
 * refunded; keeping their tier, that the scheduled move is off. A declined card is shown here and
 * changes nothing.
 */
export function PlanChangeDialog({ target, current, onClose }: { target: PaymentPlan | null; current: PaymentPlan | undefined; onClose: () => void }) {
  const { t, i18n } = useTranslation("onboarding");
  const preview = usePlanChangePreviewQuery(target?.code ?? null);
  const change = useChangePlanMutation();
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" }) : "");

  function close() {
    change.reset();
    onClose();
  }

  function confirm() {
    if (!target || !preview.data) return;
    const kind = preview.data.kind;
    change.mutate(target.code, {
      onSuccess: () => {
        toast.success(
          kind === "UPGRADE"
            ? t("planChange.upgraded", { plan: target.name })
            : kind === "DOWNGRADE"
              ? t("planChange.scheduled", { plan: target.name, date: day(preview.data!.effectiveAt) })
              : t("planChange.kept", { plan: target.name }),
        );
        close();
      },
    });
  }

  const data = preview.data;
  const title = !data || !target ? "" : data.kind === "UPGRADE" ? t("planChange.upgradeTitle", { plan: target.name }) : data.kind === "DOWNGRADE" ? t("planChange.downgradeTitle", { plan: target.name }) : t("planChange.keepTitle", { plan: target.name });
  const fee = target ? formatMoney(target.feeUsd, "USD") : "";

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !change.isPending && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title || t("planChange.loadingTitle")}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              {preview.isPending && <Loader2 className="h-5 w-5 animate-spin" aria-label={t("planChange.loadingTitle")} />}
              {preview.isError && (
                <p className="text-red-600 dark:text-red-400" role="alert">
                  {(preview.error as Error).message}
                </p>
              )}
              {data?.kind === "UPGRADE" && (
                <>
                  <p>{t("planChange.upgradeCharge", { amount: formatMoney(data.amountDueNow, data.currency) })}</p>
                  <p>{t("planChange.upgradeThen", { fee, date: day(data.renewsAt) })}</p>
                  <p>{t("planChange.upgradeLimits", { plan: target?.name })}</p>
                </>
              )}
              {data?.kind === "DOWNGRADE" && (
                <>
                  <p>{t("planChange.downgradeWhen", { current: current?.name, plan: target?.name, date: day(data.effectiveAt), fee })}</p>
                  <p>{t("planChange.downgradeNoRefund")}</p>
                  {target && target.caseLimit > 0 && <p>{t("planChange.downgradeCases", { plan: target.name, count: target.caseLimit })}</p>}
                </>
              )}
              {data?.kind === "KEEP" && <p>{t("planChange.keepBody", { plan: target?.name })}</p>}
            </div>
          </DialogDescription>
        </DialogHeader>

        {change.isError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {(change.error as Error).message}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={change.isPending}>
            {t("planChange.cancel")}
          </Button>
          <Button onClick={confirm} disabled={!data || change.isPending}>
            {change.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {data?.kind === "UPGRADE"
              ? t("planChange.upgradeConfirm", { amount: formatMoney(data.amountDueNow, data.currency) })
              : data?.kind === "DOWNGRADE"
                ? t("planChange.downgradeConfirm", { date: day(data.effectiveAt) })
                : t("planChange.keepConfirm", { plan: target?.name })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
