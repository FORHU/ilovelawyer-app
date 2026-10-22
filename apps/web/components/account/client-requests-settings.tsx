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
import { cn } from "@workspace/ui/lib/utils";
import { TagInput } from "@/components/ui/tag-input";
import {
  PRACTICE_AREAS,
  REGULATORS,
  UK_JURISDICTIONS,
  useClientRequestProfileQuery,
  useUpdateClientRequestProfileMutation,
  type ClientRequestProfile,
  type VerificationStatus,
} from "@/lib/client-requests/profile";
import {
  BIO_MAX_LENGTH,
  LANGUAGES_MAX,
  LANGUAGE_MAX_LENGTH,
  applicationPatchFromForm,
  availabilityPatchFromForm,
  formFromProfile,
  missingFromForm,
  needsRecheck,
  toggle,
  validateForm,
  type ProfileForm,
} from "@/lib/client-requests/profile-form";

// No badge before the lawyer applies: "not applied" is what the section's own call to action says.
const STATUS_TONE: Record<Exclude<VerificationStatus, "UNSUBMITTED">, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
};

function Pill({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "cursor-pointer h-8 rounded-full border px-3.5 text-[11px] font-semibold uppercase tracking-[1px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40",
        selected ? "border-transparent bg-brand-gold text-brand-gold-foreground" : "border-border text-foreground hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/**
 * Profile page section for taking on clients from the client app (UK only, app#865). A lawyer
 * applies once through a dialog (who regulates them and their number, where they're qualified,
 * what they take on, and what clients see), an admin verifies it against the regulator's register,
 * and only then do the Accept client requests switch and the availability settings appear.
 */
export function ClientRequestsSettings() {
  const { t } = useTranslation("profile");
  const query = useClientRequestProfileQuery(true);
  const status = query.data?.verification.status;

  return (
    <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 md:px-8 py-5 border-b border-border flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("clientRequests.heading")}</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5 max-w-[60ch]">{t("clientRequests.subheading")}</p>
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

  return (
    <div className="flex flex-col divide-y divide-border">
      {status === "VERIFIED" && <AcceptingRow profile={profile} />}
      {status === "VERIFIED" && <AvailabilityRow profile={profile} />}
      {status === "UNSUBMITTED" ? <ApplyPrompt profile={profile} onApply={() => setApplying(true)} /> : <ApplicationSummary profile={profile} onEdit={() => setApplying(true)} />}
      {applying && <ApplicationDialog profile={profile} onClose={() => setApplying(false)} />}
    </div>
  );
}

function ApplyPrompt({ profile, onApply }: { profile: ClientRequestProfile; onApply: () => void }) {
  const { t } = useTranslation("profile");
  // All four required fields missing means they haven't started; fewer means a saved, unfinished one.
  const started = profile.missing.length < 4;

  return (
    <div className="px-6 md:px-8 py-6 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-[14px] text-muted-foreground max-w-[60ch]">
        {started
          ? t("clientRequests.incomplete", { fields: profile.missing.map((m) => t(`clientRequests.missingFields.${m}`)).join(", ") })
          : t("clientRequests.statusHelp.UNSUBMITTED")}
      </p>
      <Button variant="accent" onClick={onApply}>
        {started ? t("clientRequests.actions.continue") : t("clientRequests.actions.apply")}
      </Button>
    </div>
  );
}

/** What the lawyer applied with, where it stands, and the way back into the dialog. */
function ApplicationSummary({ profile, onEdit }: { profile: ClientRequestProfile; onEdit: () => void }) {
  const { t } = useTranslation("profile");
  const status = profile.verification.status;
  const registration = [profile.regulator, profile.registrationNumber].filter(Boolean).join(" · ");
  const editLabel = status === "REJECTED" ? t("clientRequests.actions.resubmit") : status === "PENDING" ? t("clientRequests.actions.edit") : t("clientRequests.actions.editDetails");

  return (
    <div className="px-6 md:px-8 py-6 flex flex-col gap-5">
      {status === "REJECTED" && profile.verification.note && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-700 dark:text-red-400" role="status">
          {t("clientRequests.rejectedNote", { note: profile.verification.note })}
        </p>
      )}
      {(status === "PENDING" || status === "REJECTED") && <p className="text-[14px] text-muted-foreground max-w-[60ch]">{t(`clientRequests.statusHelp.${status}`)}</p>}
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{t("clientRequests.summary.registration")}</dt>
          <dd className="text-[14px] text-foreground">{registration || "—"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{t("clientRequests.summary.jurisdictions")}</dt>
          <dd className="text-[14px] text-foreground">{profile.qualifiedJurisdictions.join(", ") || "—"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{t("clientRequests.summary.practiceAreas")}</dt>
          <dd className="text-[14px] text-foreground">{profile.practiceAreas.map((a) => t(`clientRequests.areas.${a}`)).join(", ") || "—"}</dd>
        </div>
      </dl>
      <div>
        <Button variant={status === "REJECTED" ? "accent" : "outline"} onClick={onEdit}>
          {editLabel}
        </Button>
      </div>
    </div>
  );
}

/** The lawyer's own on/off switch. Only shown once the application is approved. */
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

/** Pause and capacity: how many clients an approved lawyer takes, and when. */
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

/** Applying, finishing an application, or changing one: everything the admin checks and what
 * clients see. Mounted only while open, so each opening starts from the saved profile. */
function ApplicationDialog({ profile, onClose }: { profile: ClientRequestProfile; onClose: () => void }) {
  const { t } = useTranslation("profile");
  const update = useUpdateClientRequestProfileMutation();
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const set = (patch: Partial<ProfileForm>) => setForm((f) => ({ ...f, ...patch }));

  const status = profile.verification.status;
  const firstSubmission = status === "UNSUBMITTED";
  // A rejected lawyer is sending it in again, not just tidying details.
  const submitsForReview = firstSubmission || status === "REJECTED";
  const errors = validateForm(form);
  const missing = missingFromForm(form);
  // Only an approved lawyer loses anything by a re-check: requests stop until it's approved again.
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
                {firstSubmission ? t("clientRequests.dialog.titleApply") : t("clientRequests.dialog.titleEdit")}
              </h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-[52ch]">{t("clientRequests.dialog.description")}</p>
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
          <div className="max-h-[min(65vh,640px)] overflow-y-auto px-6 py-6 flex flex-col gap-8">
            <fieldset className="flex flex-col gap-5">
              <legend className="mb-4 text-[15px] font-medium text-foreground">{t("clientRequests.dialog.sections.registration")}</legend>
              <div className="flex flex-col gap-2">
                <FieldLabel id="cr-regulator">{t("clientRequests.fields.regulator")}</FieldLabel>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="cr-regulator">
                  {REGULATORS.map((r) => (
                    <Pill key={r} selected={form.regulator === r} onClick={() => set({ regulator: form.regulator === r ? null : r })}>
                      {t(`clientRequests.regulators.${r}`)}
                    </Pill>
                  ))}
                </div>
              </div>
              <TextField
                label={t("clientRequests.fields.registrationNumber")}
                helperText={t("clientRequests.fields.registrationNumberHelp")}
                value={form.registrationNumber}
                onChange={(e) => set({ registrationNumber: e.target.value })}
                errorText={errors.registrationNumber}
                maxLength={40}
              />
              <div className="flex flex-col gap-2">
                <FieldLabel id="cr-jurisdictions">{t("clientRequests.fields.jurisdictions")}</FieldLabel>
                <div className="flex flex-wrap gap-2" aria-labelledby="cr-jurisdictions">
                  {UK_JURISDICTIONS.map((j) => (
                    <Pill key={j} selected={form.qualifiedJurisdictions.includes(j)} onClick={() => set({ qualifiedJurisdictions: toggle(form.qualifiedJurisdictions, j) })}>
                      {j}
                    </Pill>
                  ))}
                </div>
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-4 text-[15px] font-medium text-foreground">{t("clientRequests.dialog.sections.work")}</legend>
              <FieldLabel id="cr-areas">{t("clientRequests.fields.practiceAreas")}</FieldLabel>
              <div className="flex flex-wrap gap-2" aria-labelledby="cr-areas">
                {PRACTICE_AREAS.map((a) => (
                  <Pill key={a} selected={form.practiceAreas.includes(a)} onClick={() => set({ practiceAreas: toggle(form.practiceAreas, a) })}>
                    {t(`clientRequests.areas.${a}`)}
                  </Pill>
                ))}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Pill selected={false} disabled>
                        {t("clientRequests.areas.PERSONAL_INJURY")}
                      </Pill>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t("clientRequests.areas.personalInjuryWhy")}</TooltipContent>
                </Tooltip>
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-5">
              <legend className="mb-4 text-[15px] font-medium text-foreground">{t("clientRequests.dialog.sections.listing")}</legend>
              <div className="flex flex-col gap-2">
                <label htmlFor="cr-bio" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  {t("clientRequests.fields.bio")}
                </label>
                <p className="text-xs text-muted-foreground">{t("clientRequests.fields.bioHelp")}</p>
                <textarea
                  id="cr-bio"
                  rows={4}
                  value={form.bio}
                  maxLength={BIO_MAX_LENGTH}
                  onChange={(e) => set({ bio: e.target.value })}
                  aria-invalid={!!errors.bio}
                  className="w-full resize-y rounded-xl border border-border bg-transparent px-3 py-2.5 text-base sm:text-sm outline-none transition-colors hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5"
                />
                <p className="text-right text-xs text-muted-foreground">
                  {form.bio.length}/{BIO_MAX_LENGTH}
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <TagInput
                  label={t("clientRequests.fields.languages")}
                  helperText={t("clientRequests.fields.languagesHelp")}
                  placeholder={t("clientRequests.fields.languagesPlaceholder")}
                  value={form.languages}
                  onChange={(languages) => set({ languages })}
                  max={LANGUAGES_MAX}
                  maxTagLength={LANGUAGE_MAX_LENGTH}
                  removeLabel={(language) => t("clientRequests.fields.removeLanguage", { language })}
                />
                <TextField
                  label={t("clientRequests.fields.fee")}
                  helperText={t("clientRequests.fields.feeHelp")}
                  inputMode="decimal"
                  value={form.fee}
                  onChange={(e) => set({ fee: e.target.value })}
                  errorText={errors.fee}
                />
              </div>
            </fieldset>
          </div>

          <div className="flex flex-col gap-3 px-6 py-4 border-t border-border bg-muted/40">
            {recheckWarning && (
              <p className="text-[13px] text-amber-700 dark:text-amber-400" role="status">
                {t("clientRequests.dialog.recheckWarning")}
              </p>
            )}
            {update.isError && (
              <p className="text-[13px] text-red-600" role="alert">
                {(update.error as Error).message}
              </p>
            )}
            <div className="flex items-center justify-end gap-3 flex-wrap">
              {missing.length > 0 && (
                <p className="text-[13px] text-muted-foreground mr-auto">
                  {t("clientRequests.dialog.missing", { fields: missing.map((m) => t(`clientRequests.missingFields.${m}`)).join(", ") })}
                </p>
              )}
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
