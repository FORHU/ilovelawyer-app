"use client";

import { useState } from "react";
import { Check, Inbox, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";
import { TextField } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { LawyerApplicationFields } from "@/components/account/lawyer-application-fields";
import {
  useClientRequestProfileQuery,
  useUpdateClientRequestProfileMutation,
  type ClientRequestProfile,
  type VerificationStatus,
} from "@/lib/client-requests/profile";
import {
  applicationPatchFromForm,
  availabilityPatchFromForm,
  formFromProfile,
  missingFromForm,
  needsRecheck,
  validateForm,
  type ProfileForm,
} from "@/lib/client-requests/profile-form";

// No badge before the lawyer applies: "not applied" is what the section's own call to action says.
const STATUS_TONE: Record<Exclude<VerificationStatus, "UNSUBMITTED">, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
};

/** The Profile page's id for this section, so the reminder banner can link straight to it. */
export const LAWYER_APPLICATION_SECTION_ID = "lawyer-application";

/**
 * Profile page section for the Lawyer Application (UK and PH). A lawyer applies once through a
 * dialog (their registration, what they take on, what clients see) and an admin approves it. On
 * UK that unlocks the Accept client requests switch and the availability settings (app#865); on
 * PH approval only shows a badge for now.
 */
export function ClientRequestsSettings() {
  const { t } = useTranslation("profile");
  const query = useClientRequestProfileQuery(true);
  const status = query.data?.verification.status;
  const country = query.data?.country ?? "UK";

  return (
    <section id={LAWYER_APPLICATION_SECTION_ID} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden scroll-mt-24">
      <div className="px-6 md:px-8 py-5 border-b border-border flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t(`clientRequests.copy.${country}.heading`)}</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5 max-w-[60ch]">{t(`clientRequests.copy.${country}.subheading`)}</p>
        </div>
        {status && status !== "UNSUBMITTED" && (
          <Badge shape="pill" tone={STATUS_TONE[status]}>
            {t(`clientRequests.status.${status}`)}
          </Badge>
        )}
      </div>
      {query.isLoading && (
        <div className="px-6 md:px-8 py-6 flex flex-col gap-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {query.isError && (
        <p className="px-6 md:px-8 py-5 text-[13px] text-red-600" role="alert">
          {t("clientRequests.loadError")}
        </p>
      )}
      {query.data && <SettingsBody profile={query.data} />}
    </section>
  );
}

function SettingsBody({ profile }: { profile: ClientRequestProfile }) {
  const [applying, setApplying] = useState(false);
  const status = profile.verification.status;
  // Client requests are UK only: PH approval has no switch or availability to show.
  const receivesRequests = status === "VERIFIED" && profile.country === "UK";

  return (
    <div className="flex flex-col divide-y divide-border">
      {receivesRequests && <AcceptingRow profile={profile} />}
      {receivesRequests && <AvailabilityRow profile={profile} />}
      {status === "UNSUBMITTED" ? <ApplyPrompt profile={profile} onApply={() => setApplying(true)} /> : <ApplicationSummary profile={profile} onEdit={() => setApplying(true)} />}
      {applying && <ApplicationDialog profile={profile} onClose={() => setApplying(false)} />}
    </div>
  );
}

/** "your regulator, your registration number" etc., for a list of the API's missing-field names. */
function useMissingList() {
  const { t } = useTranslation("profile");
  return (fields: string[]) => fields.map((m) => t(`clientRequests.missingFields.${m}`)).join(", ");
}

function ApplyPrompt({ profile, onApply }: { profile: ClientRequestProfile; onApply: () => void }) {
  const { t } = useTranslation("profile");
  const missingList = useMissingList();
  // Every required field missing means they haven't started; fewer means a saved, unfinished one.
  const started = profile.missing.length < (profile.country === "PH" ? 3 : 4);

  return (
    <div className="px-6 md:px-8 py-6 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-[14px] text-muted-foreground max-w-[60ch]">
        {started ? t("clientRequests.incomplete", { fields: missingList(profile.missing) }) : t(`clientRequests.copy.${profile.country}.unsubmittedHelp`)}
      </p>
      <Button variant="accent" onClick={onApply}>
        {started ? t("clientRequests.actions.continue") : t(`clientRequests.copy.${profile.country}.apply`)}
      </Button>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="text-[14px] text-foreground">{value || "—"}</dd>
    </div>
  );
}

/** What the lawyer applied with, where it stands, and the way back into the dialog. */
function ApplicationSummary({ profile, onEdit }: { profile: ClientRequestProfile; onEdit: () => void }) {
  const { t } = useTranslation("profile");
  const status = profile.verification.status;
  const r = profile.registration;
  const areas = profile.practiceAreas.map((a) => a.name).join(", ");
  const editLabel = status === "REJECTED" ? t("clientRequests.actions.resubmit") : status === "PENDING" ? t("clientRequests.actions.edit") : t("clientRequests.actions.editDetails");

  return (
    <div className="px-6 md:px-8 py-6 flex flex-col gap-5">
      {status === "REJECTED" && profile.verification.note && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-700 dark:text-red-400" role="status">
          {t("clientRequests.rejectedNote", { note: profile.verification.note })}
        </p>
      )}
      {status === "PENDING" && <p className="text-[14px] text-muted-foreground max-w-[60ch]">{t(`clientRequests.copy.${profile.country}.pendingHelp`)}</p>}
      {status === "REJECTED" && <p className="text-[14px] text-muted-foreground max-w-[60ch]">{t(`clientRequests.copy.${profile.country}.rejectedHelp`)}</p>}
      <dl className="grid gap-4 sm:grid-cols-3">
        {r.country === "PH" ? (
          <>
            <SummaryItem label={t("clientRequests.summary.rollNumber")} value={r.rollNumber ?? ""} />
            <SummaryItem label={t("clientRequests.summary.ibpChapter")} value={r.ibpChapter ?? ""} />
          </>
        ) : (
          <>
            <SummaryItem label={t("clientRequests.summary.registration")} value={[r.regulator, r.registrationNumber].filter(Boolean).join(" · ")} />
            <SummaryItem label={t("clientRequests.summary.jurisdictions")} value={r.qualifiedJurisdictions.join(", ")} />
          </>
        )}
        <SummaryItem label={t("clientRequests.summary.practiceAreas")} value={areas} />
      </dl>
      <div>
        <Button variant={status === "REJECTED" ? "accent" : "outline"} onClick={onEdit}>
          {editLabel}
        </Button>
      </div>
    </div>
  );
}

/** The lawyer's own on/off switch. Only shown once a UK application is approved. */
function AcceptingRow({ profile }: { profile: ClientRequestProfile }) {
  const { t } = useTranslation("profile");
  const toggleAccepting = useUpdateClientRequestProfileMutation();
  const accepting = profile.acceptingRequests;

  return (
    <div className="px-6 md:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex flex-1 min-w-[16rem] gap-4 items-center">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
          <Inbox className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium text-foreground text-[16px]">{t("clientRequests.accepting.title")}</p>
          <p className="text-muted-foreground text-[14px]">{t("clientRequests.accepting.description")}</p>
          {!profile.enabledByOrganization && <p className="text-[13px] text-amber-700 dark:text-amber-400 mt-1">{t("clientRequests.accepting.offByOrganization")}</p>}
          {toggleAccepting.isError && (
            <p className="text-[13px] text-red-600 mt-1" role="alert">
              {(toggleAccepting.error as Error).message}
            </p>
          )}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="switch"
            aria-checked={accepting}
            aria-label={t("clientRequests.accepting.title")}
            disabled={toggleAccepting.isPending}
            onClick={() => toggleAccepting.mutate({ acceptingRequests: !accepting })}
            className={`cursor-pointer relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 ${accepting ? "bg-brand-gold" : "bg-muted-foreground/30"}`}
          >
            <span
              className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-background dark:bg-foreground shadow transition-transform ${accepting ? "translate-x-[22px]" : "translate-x-0.5"}`}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("clientRequests.accepting.tooltip")}</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Pause and capacity: how many clients an approved UK lawyer takes, and when. */
function AvailabilityRow({ profile }: { profile: ClientRequestProfile }) {
  const { t } = useTranslation("profile");
  const update = useUpdateClientRequestProfileMutation();
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const [saved, setSaved] = useState(false);
  const { capacityLimit: capacityError } = validateForm(form);
  const set = (patch: Partial<ProfileForm>) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };

  const save = () => {
    if (capacityError) return;
    update.mutate(availabilityPatchFromForm(form), {
      onSuccess: (next) => {
        setForm(formFromProfile(next));
        setSaved(true);
      },
    });
  };

  return (
    <div className="px-6 md:px-8 py-6 flex flex-col gap-4">
      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          label={t("clientRequests.fields.pausedUntil")}
          helperText={t("clientRequests.fields.pausedUntilHelp")}
          type="date"
          value={form.pausedUntil}
          onChange={(e) => set({ pausedUntil: e.target.value })}
        />
        <TextField
          label={t("clientRequests.fields.capacity")}
          helperText={t("clientRequests.fields.capacityHelp")}
          type="number"
          min={1}
          max={100}
          inputMode="numeric"
          value={form.capacityLimit}
          onChange={(e) => set({ capacityLimit: e.target.value })}
          errorText={capacityError}
        />
      </div>
      <div className="flex items-center justify-end gap-3 flex-wrap">
        {update.isError && (
          <p className="text-[13px] text-red-600 mr-auto" role="alert">
            {(update.error as Error).message}
          </p>
        )}
        {saved && !update.isPending && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" aria-hidden="true" />
            {t("clientRequests.availability.saved")}
          </span>
        )}
        <Button variant="outline" onClick={save} disabled={update.isPending || !!capacityError}>
          {t("clientRequests.availability.save")}
        </Button>
      </div>
    </div>
  );
}

/** Applying, finishing an application, or changing one. Mounted only while open, so each opening
 * starts from the saved profile. */
function ApplicationDialog({ profile, onClose }: { profile: ClientRequestProfile; onClose: () => void }) {
  const { t } = useTranslation("profile");
  const missingList = useMissingList();
  const update = useUpdateClientRequestProfileMutation();
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const set = (patch: Partial<ProfileForm>) => setForm((f) => ({ ...f, ...patch }));

  const status = profile.verification.status;
  const firstSubmission = status === "UNSUBMITTED";
  // A rejected lawyer is sending it in again, not just tidying details.
  const submitsForReview = firstSubmission || status === "REJECTED";
  const errors = validateForm(form);
  const missing = missingFromForm(form);
  // Only an approved lawyer loses anything by a re-check (on UK, requests stop until it's approved again).
  const recheckWarning = status === "VERIFIED" && needsRecheck(profile, form);
  const canSubmit = missing.length === 0 && Object.keys(errors).length === 0 && !update.isPending;

  const close = () => {
    if (!update.isPending) onClose();
  };

  const submit = () => {
    if (!canSubmit) return;
    update.mutate(applicationPatchFromForm(form), {
      onSuccess: (next) => {
        const joinedQueue = next.verification.status === "PENDING" && status !== "PENDING";
        toast.success(joinedQueue ? t("clientRequests.dialog.submitted") : t("clientRequests.dialog.updated"));
        onClose();
      },
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={false} className="w-[calc(100%-2rem)] max-w-2xl gap-0 overflow-hidden p-0">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border bg-muted/60">
          <div>
            <DialogTitle asChild>
              <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
                {firstSubmission ? t(`clientRequests.copy.${profile.country}.dialogTitle`) : t("clientRequests.dialog.titleEdit")}
              </h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-[52ch]">{t(`clientRequests.copy.${profile.country}.dialogDescription`)}</p>
            </DialogDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={close}
                disabled={update.isPending}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t("clientRequests.dialog.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("clientRequests.dialog.close")}</TooltipContent>
          </Tooltip>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="max-h-[min(65vh,640px)] overflow-y-auto px-6 py-6">
            <LawyerApplicationFields form={form} set={set} errors={errors} heldPracticeAreas={profile.practiceAreas} />
          </div>

          <div className="flex flex-col gap-3 px-6 py-4 border-t border-border bg-muted/40">
            {recheckWarning && (
              <p className="text-[13px] text-amber-700 dark:text-amber-400" role="status">
                {t(`clientRequests.copy.${profile.country}.recheckWarning`)}
              </p>
            )}
            {update.isError && (
              <p className="text-[13px] text-red-600" role="alert">
                {(update.error as Error).message}
              </p>
            )}
            <div className="flex items-center justify-end gap-3 flex-wrap">
              {missing.length > 0 && <p className="text-[13px] text-muted-foreground mr-auto">{t("clientRequests.dialog.missing", { fields: missingList(missing) })}</p>}
              <Button type="button" variant="ghost" onClick={close} disabled={update.isPending}>
                {t("clientRequests.dialog.cancel")}
              </Button>
              <Button type="submit" variant="accent" disabled={!canSubmit}>
                {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {update.isPending
                  ? t(submitsForReview ? "clientRequests.dialog.submitting" : "clientRequests.dialog.saving")
                  : t(submitsForReview ? "clientRequests.dialog.submit" : "clientRequests.dialog.save")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
