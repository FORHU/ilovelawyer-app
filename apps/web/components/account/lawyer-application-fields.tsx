"use client";

import { useTranslation } from "react-i18next";
import { TextField } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { TagInput } from "@/components/ui/tag-input";
import { REGULATORS, UK_JURISDICTIONS, usePracticeAreasQuery, type LawyerPracticeArea } from "@/lib/client-requests/profile";
import { keepAmount, keepDigits, keepMcleNumber, keepRomanNumeral, keepWords } from "@/lib/forms/field-rules";
import {
  BIO_MAX_LENGTH,
  LANGUAGES_MAX,
  LANGUAGE_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  toggle,
  type ProfileForm,
  type ProfileFormErrors,
} from "@/lib/client-requests/profile-form";

export function Pill({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
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

export function FieldLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/**
 * The site's practice areas, from the list admins manage (names as they wrote them, untranslated),
 * plus any area the lawyer holds that an admin has since switched off: shown dimmed, it can be
 * dropped but not picked again.
 */
function PracticeAreaPicker({ form, set, held }: { form: ProfileForm; set: (patch: Partial<ProfileForm>) => void; held: LawyerPracticeArea[] }) {
  const { t } = useTranslation("profile");
  const options = usePracticeAreasQuery(form.country);
  const retired = held.filter((a) => !a.isActive && !options.data?.some((o) => o.id === a.id));
  const pick = (id: string) => set({ practiceAreaIds: toggle(form.practiceAreaIds, id) });

  if (options.isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[24, 32, 28, 36].map((w) => (
          <Skeleton key={w} className="h-8 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
    );
  }
  if (options.isError) {
    return (
      <p className="text-[13px] text-red-600" role="alert">
        {t("clientRequests.areas.loadError")}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2" aria-labelledby="cr-areas">
      {options.data?.map((a) => (
        <Pill key={a.id} selected={form.practiceAreaIds.includes(a.id)} onClick={() => pick(a.id)}>
          {a.name}
        </Pill>
      ))}
      {retired.map((a) => {
        const selected = form.practiceAreaIds.includes(a.id);
        return (
          <Tooltip key={a.id}>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="opacity-60">
                <Pill selected={selected} disabled={!selected} onClick={() => pick(a.id)}>
                  {a.name}
                </Pill>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("clientRequests.areas.retired")}</TooltipContent>
          </Tooltip>
        );
      })}
      {/* UK only: referral fees are banned in personal injury, so the client hand-off can't send it. */}
      {form.country === "UK" && (
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
      )}
    </div>
  );
}

const sectionTitle = "mb-4 text-[15px] font-medium text-foreground";

/**
 * The Lawyer Application's fields, for the form's own country: the registration the admin checks
 * (UK: regulator, number, jurisdictions; PH: Roll number, IBP chapter and the optional IBP and MCLE
 * details), what the lawyer takes on, and what clients see. Shared by the Profile page's Apply
 * dialog and onboarding's Apply step so the two can't drift apart. Each field only takes what fits
 * it: digits for the numbers, letters for the IBP chapter and languages (lib/forms/field-rules.ts).
 */
export function LawyerApplicationFields({
  form,
  set,
  errors,
  heldPracticeAreas,
  singleColumn = false,
}: {
  form: ProfileForm;
  set: (patch: Partial<ProfileForm>) => void;
  errors: ProfileFormErrors;
  /** The saved application's areas (ClientRequestProfile.practiceAreas), for the switched-off ones. */
  heldPracticeAreas: LawyerPracticeArea[];
  /** One field per row, for onboarding's narrow column; the Profile dialog pairs some up. */
  singleColumn?: boolean;
}) {
  const { t } = useTranslation("profile");
  const country = form.country;
  const pairs = singleColumn ? "grid gap-5" : "grid gap-5 md:grid-cols-2";

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-5">
        <legend className={sectionTitle}>{t("clientRequests.dialog.sections.registration")}</legend>
        {country === "PH" ? (
          <div className={pairs}>
            <TextField
              label={t("clientRequests.fields.rollNumber")}
              helperText={t("clientRequests.fields.rollNumberHelp")}
              inputMode="numeric"
              value={form.rollNumber}
              onChange={(e) => set({ rollNumber: keepDigits(e.target.value) })}
              errorText={errors.rollNumber}
              maxLength={TEXT_MAX_LENGTH.rollNumber}
            />
            <TextField
              label={t("clientRequests.fields.ibpChapter")}
              helperText={t("clientRequests.fields.ibpChapterHelp")}
              value={form.ibpChapter}
              onChange={(e) => set({ ibpChapter: keepWords(e.target.value) })}
              errorText={errors.ibpChapter}
              maxLength={TEXT_MAX_LENGTH.ibpChapter}
            />
            <TextField
              label={t("clientRequests.fields.ibpMembershipNumber")}
              helperText={t("clientRequests.fields.ibpMembershipNumberHelp")}
              inputMode="numeric"
              value={form.ibpMembershipNumber}
              onChange={(e) => set({ ibpMembershipNumber: keepDigits(e.target.value) })}
              errorText={errors.ibpMembershipNumber}
              maxLength={TEXT_MAX_LENGTH.ibpMembershipNumber}
            />
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <TextField
                label={t("clientRequests.fields.mcleNumber")}
                value={form.mcleNumber}
                onChange={(e) => set({ mcleNumber: keepMcleNumber(e.target.value) })}
                errorText={errors.mcleNumber}
                maxLength={TEXT_MAX_LENGTH.mcleNumber}
              />
              <TextField
                label={t("clientRequests.fields.mclePeriod")}
                helperText={t("clientRequests.fields.mclePeriodHelp")}
                value={form.mclePeriod}
                onChange={(e) => set({ mclePeriod: keepRomanNumeral(e.target.value) })}
                errorText={errors.mclePeriod}
                maxLength={TEXT_MAX_LENGTH.mclePeriod}
              />
            </div>
          </div>
        ) : (
          <>
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
              inputMode="numeric"
              value={form.registrationNumber}
              onChange={(e) => set({ registrationNumber: keepDigits(e.target.value) })}
              errorText={errors.registrationNumber}
              maxLength={TEXT_MAX_LENGTH.registrationNumber}
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
          </>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={sectionTitle}>{t("clientRequests.dialog.sections.work")}</legend>
        <FieldLabel id="cr-areas">{t("clientRequests.fields.practiceAreas")}</FieldLabel>
        <PracticeAreaPicker form={form} set={set} held={heldPracticeAreas} />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className={sectionTitle}>{t("clientRequests.dialog.sections.listing")}</legend>
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
        <div className={pairs}>
          <TagInput
            label={t("clientRequests.fields.languages")}
            helperText={t("clientRequests.fields.languagesHelp")}
            placeholder={t("clientRequests.fields.languagesPlaceholder")}
            value={form.languages}
            onChange={(languages) => set({ languages })}
            max={LANGUAGES_MAX}
            maxTagLength={LANGUAGE_MAX_LENGTH}
            keep={keepWords}
            removeLabel={(language) => t("clientRequests.fields.removeLanguage", { language })}
          />
          <TextField
            label={t(country === "PH" ? "clientRequests.fields.feePH" : "clientRequests.fields.feeUK")}
            helperText={t("clientRequests.fields.feeHelp")}
            inputMode="decimal"
            value={form.fee}
            onChange={(e) => set({ fee: keepAmount(e.target.value) })}
            errorText={errors.fee}
          />
        </div>
      </fieldset>
    </div>
  );
}
