"use client";

import { useTranslation } from "react-i18next";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";
import { setupHeadingClass, setupSecondaryButtonClass, setupSubtitleClass } from "@/components/onboarding/styles";
import { PLANS, type Plan, type PlanId } from "@/lib/onboarding/plans";

/** Each plan's card: dark, with its own color glowing up from the bottom. The same in light and dark
 * themes, so the white text always reads. */
const PLAN_GLOW: Record<PlanId, string> = {
  BASIC: "bg-[radial-gradient(130%_85%_at_50%_100%,#22c55e_0%,#14532d_38%,#0a0a0a_78%)]",
  PRO: "bg-[radial-gradient(130%_85%_at_50%_100%,#3b82f6_0%,#1e3a8a_38%,#0a0a1a_78%)]",
  MAX: "bg-[radial-gradient(130%_85%_at_50%_100%,#8b5cf6_0%,#4c1d95_38%,#0f0a1a_78%)]",
};

function PlanCard({ plan, onChoose }: { plan: Plan; onChoose: () => void }) {
  const { t } = useTranslation("onboarding");
  const name = t(`plan.names.${plan.id}`);
  const features = [t("plan.cases", { count: plan.cases }), t("plan.aiUsage", { amount: `$${plan.aiUsageUsd}` })];

  return (
    <article className={cn("flex min-h-[22rem] flex-col rounded-2xl border border-white/10 p-6 text-white shadow-xl shadow-black/20", PLAN_GLOW[plan.id])}>
      <h2 className="text-[28px] font-semibold leading-tight">{name}</h2>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[26px] leading-none">${plan.priceUsd}</span>
        <span className="text-xs text-white/60">{t("plan.perMonth")}</span>
      </p>
      <p className="mt-1 text-xs text-white/60">{t("plan.billedMonthly")}</p>

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
        className="mt-auto w-full cursor-pointer rounded-xl bg-white py-3 text-sm font-semibold text-neutral-900 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {t("plan.choose", { plan: name })}
      </button>
    </article>
  );
}

/**
 * Onboarding's last step, for a solo lawyer and a firm's founder: choosing a subscription plan, or
 * skipping it. MOCK, UI only: there's no billing yet, so nothing is charged and the choice isn't
 * saved (see lib/onboarding/plans.ts). The plans sit side by side in one row, so the page widens for
 * this step (OnboardingShell's `wide`).
 */
export function PlanStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("onboarding");

  function choose(plan: Plan) {
    toast.success(t("plan.chosen", { plan: t(`plan.names.${plan.id}`) }));
    onDone();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1 text-center">
        <h1 className={setupHeadingClass}>{t("plan.title")}</h1>
        <p className={setupSubtitleClass}>{t("plan.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onChoose={() => choose(plan)} />
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <button type="button" onClick={onDone} className={setupSecondaryButtonClass}>
          {t("plan.skip")}
        </button>
        <p className="text-center text-xs text-muted-foreground">{t("plan.preview")}</p>
      </div>
    </div>
  );
}
