"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LawyerApplicationFields } from "@/components/account/lawyer-application-fields";
import { setupHeadingClass, setupPrimaryButtonClass, setupSecondaryButtonClass, setupSubtitleClass } from "@/components/onboarding/styles";
import { useUpdateClientRequestProfileMutation, type ClientRequestProfile } from "@/lib/client-requests/profile";
import { applicationPatchFromForm, formFromProfile, missingFromForm, validateForm, type ProfileForm } from "@/lib/client-requests/profile-form";

/**
 * Onboarding's Apply step: the Lawyer Application form (the same fields as the Profile page's Apply
 * dialog), with Submit and Later. Later leaves it unsubmitted; the Profile page and the homepage
 * reminder bring the lawyer back to it.
 */
export function ApplyStep({ profile, onDone }: { profile: ClientRequestProfile; onDone: () => void }) {
  const { t } = useTranslation("onboarding");
  const { t: tProfile } = useTranslation("profile");
  const update = useUpdateClientRequestProfileMutation();
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const set = (patch: Partial<ProfileForm>) => setForm((f) => ({ ...f, ...patch }));

  const errors = validateForm(form);
  const missing = missingFromForm(form);
  const canSubmit = missing.length === 0 && Object.keys(errors).length === 0 && !update.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    update.mutate(applicationPatchFromForm(form), {
      onSuccess: () => {
        toast.success(t("apply.submitted"));
        onDone();
      },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className={setupHeadingClass}>{tProfile(`clientRequests.copy.${profile.country}.dialogTitle`)}</h1>
        <p className={setupSubtitleClass}>{tProfile(`clientRequests.copy.${profile.country}.dialogDescription`)}</p>
      </div>

      <LawyerApplicationFields form={form} set={set} errors={errors} singleColumn />

      {update.isError && (
        <p className="text-[13px] text-red-600" role="alert">
          {(update.error as Error).message}
        </p>
      )}
      {missing.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          {tProfile("clientRequests.dialog.missing", { fields: missing.map((m) => tProfile(`clientRequests.missingFields.${m}`)).join(", ") })}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <button type="submit" disabled={!canSubmit} className={setupPrimaryButtonClass}>
          {update.isPending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          {update.isPending ? t("apply.submitting") : t("apply.submit")}
        </button>
        <button type="button" onClick={onDone} disabled={update.isPending} className={setupSecondaryButtonClass}>
          {t("apply.later")}
        </button>
      </div>
    </form>
  );
}
