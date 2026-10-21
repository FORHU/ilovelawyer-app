"use client";

import { useState } from "react";
import { Check, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { TextField } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import {
  PRACTICE_AREAS,
  REGULATORS,
  UK_JURISDICTIONS,
  useClientRequestProfileQuery,
  useUpdateClientRequestProfileMutation,
  type ClientRequestProfile,
  type VerificationStatus,
} from "@/lib/client-requests/profile";
import { BIO_MAX_LENGTH, formFromProfile, patchFromForm, toggle, validateForm, type ProfileForm } from "@/lib/client-requests/profile-form";

const STATUS_TONE: Record<VerificationStatus, "neutral" | "warning" | "success" | "danger"> = {
  UNSUBMITTED: "neutral",
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
 * Profile page section for receiving clients from the client app (UK only, app#865): who
 * regulates the lawyer and their number, where they're qualified, what they take on, a bio,
 * languages, a first-consultation fee, and the Accept client requests switch with a pause date and
 * a capacity limit. Shows where verification stands; the switch only turns on once verified.
 */
export function ClientRequestsSettings() {
  const { t } = useTranslation("profile");
  const query = useClientRequestProfileQuery(true);

  return (
    <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 md:px-8 py-5 border-b border-border flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("clientRequests.heading")}</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5 max-w-[60ch]">{t("clientRequests.subheading")}</p>
        </div>
        {query.data && (
          <Badge shape="pill" tone={STATUS_TONE[query.data.verification.status]}>
            {t(`clientRequests.status.${query.data.verification.status}`)}
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
  const { t } = useTranslation("profile");
  const update = useUpdateClientRequestProfileMutation();
  const toggleAccepting = useUpdateClientRequestProfileMutation();
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const [saved, setSaved] = useState(false);
  const errors = validateForm(form);
  const set = (patch: Partial<ProfileForm>) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };

  const verified = profile.verification.status === "VERIFIED";
  const accepting = profile.acceptingRequests;
  const switchDisabledReason = !verified ? t("clientRequests.accepting.needsVerification") : null;

  const save = () => {
    if (Object.keys(errors).length) return;
    update.mutate(patchFromForm(form), {
      // The form shows what the API kept (trimmed, de-duplicated), not just what was typed.
      onSuccess: (next) => {
        setForm(formFromProfile(next));
        setSaved(true);
      },
    });
  };

  return (
    <div className="flex flex-col divide-y divide-border">
      {/* Accept client requests */}
      <div className="px-6 md:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-1 min-w-[16rem] gap-4 items-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
            <Inbox className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-foreground text-[16px]">{t("clientRequests.accepting.title")}</p>
            <p className="text-muted-foreground text-[14px]">{switchDisabledReason ?? t("clientRequests.accepting.description")}</p>
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
              disabled={(!verified && !accepting) || toggleAccepting.isPending}
              onClick={() => toggleAccepting.mutate({ acceptingRequests: !accepting })}
              className={`cursor-pointer relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 ${accepting ? "bg-brand-gold" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-background dark:bg-foreground shadow transition-transform ${accepting ? "translate-x-[22px]" : "translate-x-0.5"}`}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>{switchDisabledReason ?? t("clientRequests.accepting.tooltip")}</TooltipContent>
        </Tooltip>
      </div>

      {profile.verification.status === "REJECTED" && profile.verification.note && (
        <div className="px-6 md:px-8 py-4 text-[13px] text-red-700 dark:text-red-400" role="status">
          {t("clientRequests.rejectedNote", { note: profile.verification.note })}
        </div>
      )}

      <div className="px-6 md:px-8 py-6 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:col-span-2">
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

        <div className="flex flex-col gap-2 md:col-span-2">
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
        </div>

        <div className="flex flex-col gap-2 md:col-span-2">
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

        <TextField
          label={t("clientRequests.fields.languages")}
          helperText={t("clientRequests.fields.languagesHelp")}
          value={form.languages}
          onChange={(e) => set({ languages: e.target.value })}
        />

        <TextField
          label={t("clientRequests.fields.fee")}
          helperText={t("clientRequests.fields.feeHelp")}
          inputMode="decimal"
          value={form.fee}
          onChange={(e) => set({ fee: e.target.value })}
          errorText={errors.fee}
        />

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
          errorText={errors.capacityLimit}
        />
      </div>

      <div className="px-6 md:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-[13px] text-muted-foreground">
          {profile.missing.length > 0
            ? t("clientRequests.missing", { fields: profile.missing.map((m) => t(`clientRequests.missingFields.${m}`)).join(", ") })
            : t(`clientRequests.statusHelp.${profile.verification.status}`)}
          {update.isError && (
            <p className="text-red-600 mt-1" role="alert">
              {(update.error as Error).message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saved && !update.isPending && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" aria-hidden="true" />
              {t("clientRequests.saved")}
            </span>
          )}
          <Button variant="accent" onClick={save} disabled={update.isPending || Object.keys(errors).length > 0}>
            {update.isPending ? t("clientRequests.saving") : t("clientRequests.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
