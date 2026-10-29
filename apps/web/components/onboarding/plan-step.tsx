"use client";

import { useTranslation } from "react-i18next";
import { PlanPicker } from "@/components/account/plan-picker";
import { setupSecondaryButtonClass } from "@/components/onboarding/styles";

/**
 * Onboarding's last step, for a solo lawyer and a firm's founder: subscribing to a plan
 * (PlanPicker), or skipping it. Skipping leaves the account on the cheapest plan, unpaid. A solo
 * lawyer (`trial`) then has a 14-day free trial of it, from approval (ilovelawyer-api's
 * PlanTrialSvc), after which the account is read-only until they subscribe on /plans; a firm's
 * founder has no trial yet. `trialStartsNow`: the /verification plan step, where the trial starts on
 * that click rather than at approval (verify before plan).
 *
 * `onDone` runs once they've subscribed (or already had); `onSkip`, when given, runs for Skip
 * instead, and `skipping` holds the Skip button while that's under way.
 */
export function PlanStep({
  onDone,
  onSkip,
  skipping = false,
  trial,
  trialStartsNow = false,
}: {
  onDone: () => void;
  onSkip?: () => void;
  skipping?: boolean;
  trial: boolean;
  trialStartsNow?: boolean;
}) {
  const { t } = useTranslation("onboarding");
  return (
    <PlanPicker
      onDone={onDone}
      subtitle={trial ? t("plan.subtitleTrial") : undefined}
      footer={
        <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
          <button type="button" onClick={onSkip ?? onDone} disabled={skipping} className={setupSecondaryButtonClass}>
            {trial ? t("plan.skipTrial") : t("plan.skip")}
          </button>
          <p className="text-center text-xs text-muted-foreground">{trial ? t(trialStartsNow ? "plan.skipNoteTrialNow" : "plan.skipNoteTrial") : t("plan.skipNote")}</p>
        </div>
      }
    />
  );
}
