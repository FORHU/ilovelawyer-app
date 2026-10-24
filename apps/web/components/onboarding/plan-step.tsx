"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";
import { setupHeadingClass, setupPrimaryButtonClass, setupSecondaryButtonClass, setupSubtitleClass } from "@/components/onboarding/styles";
import {
  usePaymentPlanCheckoutStatusQuery,
  usePaymentPlansQuery,
  useStartPaymentPlanCheckoutMutation,
  type PaymentPlan,
} from "@/lib/account/payment-plans";

/** Each plan's card: dark, with its own color glowing up from the bottom, by rank (cheapest first).
 * The same in light and dark themes, so the white text always reads. */
const PLAN_GLOWS = [
  "bg-[radial-gradient(130%_85%_at_50%_100%,#22c55e_0%,#14532d_38%,#0a0a0a_78%)]",
  "bg-[radial-gradient(130%_85%_at_50%_100%,#3b82f6_0%,#1e3a8a_38%,#0a0a1a_78%)]",
  "bg-[radial-gradient(130%_85%_at_50%_100%,#8b5cf6_0%,#4c1d95_38%,#0f0a1a_78%)]",
];

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function PlanCard({ plan, rank, busy, onChoose }: { plan: PaymentPlan; rank: number; busy: boolean; onChoose: () => void }) {
  const { t } = useTranslation("onboarding");
  const features = [
    plan.caseLimit > 0 ? t("plan.cases", { count: plan.caseLimit }) : t("plan.casesUnlimited"),
    t("plan.aiUsage", { amount: formatUsd(plan.includedAllowanceUsd) }),
  ];

  return (
    <article className={cn("flex min-h-[22rem] flex-col rounded-2xl border border-white/10 p-6 text-white shadow-xl shadow-black/20", PLAN_GLOWS[Math.min(rank, PLAN_GLOWS.length - 1)])}>
      <h2 className="text-[28px] font-semibold leading-tight">{plan.name}</h2>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[26px] leading-none">{formatUsd(plan.feeUsd)}</span>
        <span className="text-xs text-white/60">{t("plan.perMonth")}</span>
      </p>
      <p className="mt-1 text-xs text-white/60">{t("plan.billedMonthly")}</p>
      {plan.description && <p className="mt-4 text-sm text-white/75">{plan.description}</p>}

      <ul className="mt-6 flex flex-col text-sm text-white/85">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 border-b border-white/10 py-3 first:pt-0">
            <CircleCheck className="h-4 w-4 shrink-0 text-white/80" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onChoose}
        disabled={busy}
        className="mt-auto flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-neutral-900 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {t("plan.choose", { plan: plan.name })}
      </button>
    </article>
  );
}

/**
 * Onboarding's last step, for a solo lawyer and a firm's founder: subscribing to one of their
 * tenant's plans (ilovelawyer-api's PaymentPlanBillingSvc), or skipping it. Choosing a plan opens
 * Stripe's embedded checkout right here; the first month is charged there, and the step moves on
 * once the API reports the subscription ACTIVE (polled, so no webhook is needed to see it). Skipping
 * leaves the account on the cheapest plan, unpaid, until the lawyer subscribes. The plans sit side
 * by side in one row, so the page widens for this step (OnboardingShell's `wide`).
 */
export function PlanStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("onboarding");
  const options = usePaymentPlansQuery();
  const start = useStartPaymentPlanCheckoutMutation();
  const [choosing, setChoosing] = useState<PaymentPlan | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{ clientSecret: string; publishableKey: string } | null>(null);
  const status = usePaymentPlanCheckoutStatusQuery(subscriptionId);

  // Keyed on the publishable key alone: loadStripe only needs to run again if the key changes,
  // never for a new client secret on the same key.
  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (checkout ? loadStripe(checkout.publishableKey) : null),
    [checkout?.publishableKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const active = status.data?.status === "ACTIVE";
  const failed = status.data?.status === "EXPIRED" || status.data?.status === "CANCELED";

  // Once the plan is active the step is done. An effect, not the query's onSuccess: the result can
  // also arrive from a refetch the user didn't trigger.
  useEffect(() => {
    if (!active) return;
    toast.success(t("plan.success", { plan: choosing?.name ?? status.data?.planCode }));
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function choose(plan: PaymentPlan) {
    setChoosing(plan);
    start.mutate(plan.code, {
      onSuccess: (result) => {
        setSubscriptionId(result.subscriptionId);
        if (result.checkout) setCheckout({ clientSecret: result.checkout.clientSecret, publishableKey: result.checkout.publishableKey });
      },
      onError: (err) => {
        // Paid in another tab (or a checkout that settled meanwhile): there's nothing left to choose.
        if ((err as { code?: string }).code === "ALREADY_SUBSCRIBED") void options.refetch();
      },
    });
  }

  function backToPlans() {
    setChoosing(null);
    setSubscriptionId(null);
    setCheckout(null);
    start.reset();
  }

  const heading = (
    <div className="flex flex-col gap-1 text-center">
      <h1 className={setupHeadingClass}>{checkout && choosing ? t("plan.paymentTitle", { plan: choosing.name }) : t("plan.title")}</h1>
      {!checkout && <p className={setupSubtitleClass}>{t("plan.subtitle")}</p>}
    </div>
  );

  if (options.isPending) {
    return (
      <div className="flex flex-col items-center gap-8">
        {heading}
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label={t("plan.loading")} />
      </div>
    );
  }

  if (options.data?.subscribed) {
    const current = options.data.plans.find((p) => p.code === options.data.currentPlanCode);
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 text-center">
        <h1 className={setupHeadingClass}>{t("plan.subscribed", { plan: current?.name ?? options.data.currentPlanCode })}</h1>
        <button type="button" onClick={onDone} className={setupPrimaryButtonClass}>
          {t("plan.continue")}
        </button>
      </div>
    );
  }

  if (checkout) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        {heading}
        {failed ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {status.data?.failureReason ?? t("plan.failed")}
            </p>
          </div>
        ) : (
          stripePromise && (
            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: checkout.clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )
        )}
        <button type="button" onClick={backToPlans} className={setupSecondaryButtonClass}>
          {t("plan.backToPlans")}
        </button>
      </div>
    );
  }

  const plans = options.data?.plans ?? [];
  return (
    <div className="flex flex-col gap-8">
      {heading}

      {options.isError ? (
        <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
          {t("plan.loadFailed")}
        </p>
      ) : (
        <div className={cn("grid gap-4", plans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {plans.map((plan, rank) => (
            <PlanCard key={plan.code} plan={plan} rank={rank} busy={start.isPending && choosing?.code === plan.code} onChoose={() => choose(plan)} />
          ))}
        </div>
      )}

      {start.isError && (
        <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
          {(start.error as Error).message}
        </p>
      )}

      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <button type="button" onClick={onDone} className={setupSecondaryButtonClass}>
          {t("plan.skip")}
        </button>
        <p className="text-center text-xs text-muted-foreground">{t("plan.skipNote")}</p>
      </div>
    </div>
  );
}
