"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { setupHeadingClass, setupPrimaryButtonClass, setupSecondaryButtonClass, setupSubtitleClass } from "@/components/onboarding/styles";
import { PlanChangeDialog } from "@/components/account/plan-change-dialog";
import { isFeatureEnabled } from "@/config/tenant-codes/capabilities";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  usePaymentPlanCheckoutStatusQuery,
  usePaymentPlansQuery,
  useStartPaymentPlanCheckoutMutation,
  type PaymentPlan,
} from "@/lib/account/payment-plans";

/** Where the picker sits: onboarding's full-screen plan step, or the app's Plans page under the
 * header (lighter cards that match the rest of the app, the page's own heading, and plan changes). */
type PlanPickerVariant = "onboarding" | "page";

/** Onboarding's cards: dark, with each plan's own color glowing up from the bottom, by rank (cheapest
 * first). The same in light and dark themes, so the white text always reads. */
const PLAN_GLOWS = [
  "bg-[radial-gradient(130%_85%_at_50%_100%,#22c55e_0%,#14532d_38%,#0a0a0a_78%)]",
  "bg-[radial-gradient(130%_85%_at_50%_100%,#3b82f6_0%,#1e3a8a_38%,#0a0a1a_78%)]",
  "bg-[radial-gradient(130%_85%_at_50%_100%,#8b5cf6_0%,#4c1d95_38%,#0f0a1a_78%)]",
];

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** One plan's card. `label` replaces "Choose {plan}" on its button (Upgrade, Switch, Keep), `badge`
 * marks it (the current plan, or the one a downgrade moves to), `current` outlines it on the page,
 * and `disabled` leaves the button off. */
function PlanCard({
  plan,
  rank,
  busy,
  onChoose,
  variant,
  label,
  badge,
  current = false,
  disabled = false,
}: {
  plan: PaymentPlan;
  rank: number;
  busy: boolean;
  onChoose: () => void;
  variant: PlanPickerVariant;
  label?: string;
  badge?: string;
  current?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation("onboarding");
  // Client requests come from the client app on the UK site only.
  const clientRequests = isFeatureEnabled(useAuthStore((s) => s.organization?.tenantCode), "clientRequests");
  const features = [
    plan.caseLimit > 0 ? t("plan.cases", { count: plan.caseLimit }) : t("plan.casesUnlimited"),
    t("plan.aiUsage", { amount: formatUsd(plan.includedAllowanceUsd) }),
    ...(clientRequests
      ? [plan.clientRequestLimit > 0 ? t("plan.clientRequests", { count: plan.clientRequestLimit }) : t("plan.clientRequestsUnlimited")]
      : []),
  ];
  const buttonLabel = label ?? t("plan.choose", { plan: plan.name });

  if (variant === "page") {
    return (
      <article
        className={cn(
          "flex flex-col rounded-2xl border bg-card p-6 text-card-foreground shadow-sm transition-colors",
          current ? "border-brand-gold ring-1 ring-brand-gold/30" : "border-border hover:border-foreground/20",
        )}
      >
        <div className="flex min-h-6 items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold text-foreground">{plan.name}</h2>
          {badge && (
            <span className="shrink-0 rounded-full bg-brand-gold/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[1px] text-amber-700 dark:text-brand-gold">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-4 flex items-baseline gap-1.5">
          <span className="font-['Libre_Caslon_Text'] text-[40px] leading-none text-foreground">{formatUsd(plan.feeUsd)}</span>
          <span className="text-sm text-muted-foreground">{t("plan.perMonth")}</span>
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("plan.billedMonthly")}</p>
        {plan.description && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>}

        <ul className="mt-6 flex flex-col gap-3 border-t border-border pt-5 text-sm text-foreground">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5">
              <CircleCheck className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>

        <Button className="mt-8 w-full" variant={current || disabled ? "outline" : "default"} onClick={onChoose} disabled={busy || disabled}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {buttonLabel}
        </Button>
      </article>
    );
  }

  return (
    <article className={cn("flex min-h-[22rem] flex-col rounded-2xl border border-white/10 p-6 text-white shadow-xl shadow-black/20", PLAN_GLOWS[Math.min(rank, PLAN_GLOWS.length - 1)])}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[28px] font-semibold leading-tight">{plan.name}</h2>
        {badge && <span className="mt-1.5 shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white">{badge}</span>}
      </div>
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
        disabled={busy || disabled}
        className="mt-auto flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-neutral-900 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {buttonLabel}
      </button>
    </article>
  );
}

function planGridClass(count: number) {
  return cn("grid gap-4", count >= 3 ? "md:grid-cols-3" : "md:grid-cols-2");
}

/**
 * Subscribing to one of the lawyer's tenant's plans (ilovelawyer-api's PaymentPlanBillingSvc): the
 * plans side by side, each opening Stripe's embedded checkout right here. The first month is charged
 * there; once the API reports the subscription ACTIVE (polled, so no webhook is needed to see it)
 * `onDone` runs, or, without one, the plans show again with the new one marked.
 *
 * `variant="onboarding"` is the plan step: its own heading, `subtitle` and `footer` (Skip), and just
 * "Continue" for a lawyer who already pays. `variant="page"` is the Plans page under the app header,
 * which brings its own heading: a lawyer who already pays sees every plan with theirs marked and can
 * upgrade or downgrade (PlanChangeDialog).
 */
export function PlanPicker({
  onDone,
  subtitle,
  footer,
  variant = "onboarding",
}: {
  onDone?: () => void;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: PlanPickerVariant;
}) {
  const { t, i18n } = useTranslation("onboarding");
  const page = variant === "page";
  const [changingTo, setChangingTo] = useState<PaymentPlan | null>(null);
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
    if (onDone) onDone();
    else backToPlans();
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

  // The page has its own heading; only the checkout gets a title of its own there.
  const heading = page ? (
    checkout && choosing ? <h2 className="text-[20px] font-semibold text-foreground">{t("plan.paymentTitle", { plan: choosing.name })}</h2> : null
  ) : (
    <div className="flex flex-col gap-1 text-center">
      <h1 className={setupHeadingClass}>{checkout && choosing ? t("plan.paymentTitle", { plan: choosing.name }) : t("plan.title")}</h1>
      {!checkout && <p className={setupSubtitleClass}>{subtitle ?? t("plan.subtitle")}</p>}
    </div>
  );

  if (options.isPending) {
    return page ? (
      <div className={planGridClass(3)} aria-label={t("plan.loading")}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[22rem] rounded-2xl" />
        ))}
      </div>
    ) : (
      <div className="flex flex-col items-center gap-8">
        {heading}
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label={t("plan.loading")} />
      </div>
    );
  }

  if (options.data?.subscribed && page) {
    const { plans, currentPlanCode, scheduledPlanCode, renewsAt } = options.data;
    const current = plans.find((p) => p.code === currentPlanCode);
    const scheduled = plans.find((p) => p.code === scheduledPlanCode);
    const renewsOn = renewsAt ? new Date(renewsAt).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" }) : "";
    const cardProps = (plan: PaymentPlan): { label: string; badge?: string; current?: boolean; disabled?: boolean } => {
      if (plan.code === currentPlanCode) {
        return scheduled
          ? { label: t("planChange.keep", { plan: plan.name }), badge: t("planChange.current"), current: true }
          : { label: t("planChange.yours"), badge: t("planChange.current"), current: true, disabled: true };
      }
      if (plan.code === scheduledPlanCode) return { label: t("planChange.scheduledLabel"), badge: t("planChange.from", { date: renewsOn }), disabled: true };
      return { label: current && plan.feeUsd > current.feeUsd ? t("planChange.upgrade", { plan: plan.name }) : t("planChange.switch", { plan: plan.name }) };
    };
    return (
      <>
        <div className={planGridClass(plans.length)}>
          {plans.map((plan, rank) => (
            <PlanCard key={plan.code} plan={plan} rank={rank} busy={false} variant={variant} onChoose={() => setChangingTo(plan)} {...cardProps(plan)} />
          ))}
        </div>
        <PlanChangeDialog target={changingTo} current={current} onClose={() => setChangingTo(null)} />
      </>
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
      <div className={cn("flex w-full max-w-xl flex-col gap-6", !page && "mx-auto")}>
        {heading}
        {failed ? (
          <div className={cn("flex flex-col gap-3", !page && "items-center text-center")}>
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
        {page ? (
          <Button variant="outline" className="self-start" onClick={backToPlans}>
            {t("plan.backToPlans")}
          </Button>
        ) : (
          <button type="button" onClick={backToPlans} className={setupSecondaryButtonClass}>
            {t("plan.backToPlans")}
          </button>
        )}
      </div>
    );
  }

  const plans = options.data?.plans ?? [];
  return (
    <div className="flex flex-col gap-8">
      {heading}

      {options.isError ? (
        <p className={cn("text-sm text-red-600 dark:text-red-400", !page && "text-center")} role="alert">
          {t("plan.loadFailed")}
        </p>
      ) : (
        <div className={planGridClass(plans.length)}>
          {plans.map((plan, rank) => (
            <PlanCard key={plan.code} plan={plan} rank={rank} variant={variant} busy={start.isPending && choosing?.code === plan.code} onChoose={() => choose(plan)} />
          ))}
        </div>
      )}

      {start.isError && (
        <p className={cn("text-sm text-red-600 dark:text-red-400", !page && "text-center")} role="alert">
          {(start.error as Error).message}
        </p>
      )}

      {footer}
    </div>
  );
}
