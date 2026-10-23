"use client";

import { useContext } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { ProgressSlotContext } from "@/components/onboarding/onboarding-shell";

/** Account setup's steps after choosing Solo or Law firm (the choice itself isn't one), in order.
 * "review" is the admin's approval, shown last for an account still pending (/account-pending): it
 * isn't a step the lawyer fills in, only where they're heading. */
export type SetupStepId = "firm" | "invite" | "apply" | "plan" | "review";

/** Where the lawyer is in account setup: the steps behind them ticked, the current one highlighted,
 * the rest still to come. Shown from the step after choosing Solo or Law firm to the last. Inside an
 * OnboardingShell it's drawn in the shell's top bar, in the same row as the back arrow. */
export function StepIndicator({ steps, current }: { steps: SetupStepId[]; current: SetupStepId }) {
  const { t } = useTranslation("onboarding");
  const slot = useContext(ProgressSlotContext);
  const at = steps.indexOf(current);
  const indicator = (
    <ol className="flex items-center gap-2 whitespace-nowrap text-xs" aria-label={t("steps.label", { current: at + 1, total: steps.length })}>
      {steps.map((step, i) => {
        const done = i < at;
        const active = i === at;
        return (
          <li key={step} className="flex items-center gap-2">
            {i > 0 && <span className={cn("h-px w-6", done || active ? "bg-foreground/40" : "bg-border")} aria-hidden="true" />}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                active ? "bg-primary/10 text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60"
              )}
              aria-current={active ? "step" : undefined}
            >
              {done && <Check className="h-3 w-3" aria-hidden="true" />}
              {t(`steps.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
  // In a shell: wait for its top bar rather than flash in the column first.
  if (slot === undefined) return indicator;
  return slot ? createPortal(indicator, slot) : null;
}
