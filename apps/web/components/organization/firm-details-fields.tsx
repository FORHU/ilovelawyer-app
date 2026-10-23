"use client";

import { useTranslation } from "react-i18next";
import { TextField } from "@workspace/ui/components/input";
import { FieldLabel, Pill } from "@/components/account/lawyer-application-fields";
import { REGULATORS, type Regulator } from "@/lib/client-requests/profile";
import type { FirmDetailsPayload } from "@/lib/organizations/mutations";
import type { OrganizationRecord } from "@/lib/organizations/queries";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";
import { NUMBER_MAX_DIGITS, keepDigits, keepPhone, keepUkPostcode, keepWords, phoneProblem, postcodeProblem } from "@/lib/forms/field-rules";

/** A firm's details as typed. Only the name is required. */
export interface FirmDetailsForm {
  name: string;
  firmRegulator: Regulator | null;
  firmRegistrationNumber: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
}

export const EMPTY_FIRM: FirmDetailsForm = {
  name: "",
  firmRegulator: null,
  firmRegistrationNumber: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
};

export function firmFormFromOrganization(org: OrganizationRecord): FirmDetailsForm {
  return {
    name: org.name,
    firmRegulator: org.firmRegulator,
    firmRegistrationNumber: org.firmRegistrationNumber ?? "",
    phone: org.phone ?? "",
    addressLine1: org.addressLine1 ?? "",
    addressLine2: org.addressLine2 ?? "",
    city: org.city ?? "",
    postcode: org.postcode ?? "",
  };
}

/** The details to send. Empty fields clear; the firm regulator and number only go to a UK firm
 * (the API refuses them elsewhere). */
export function firmDetailsPayload(f: FirmDetailsForm, tenantCode: TenantCode | null): FirmDetailsPayload {
  const text = (v: string) => v.trim() || null;
  return {
    phone: text(f.phone),
    addressLine1: text(f.addressLine1),
    addressLine2: text(f.addressLine2),
    city: text(f.city),
    postcode: text(f.postcode),
    ...(tenantCode === "UK" ? { firmRegulator: f.firmRegulator, firmRegistrationNumber: text(f.firmRegistrationNumber) } : {}),
  };
}

export type FirmDetailsErrors = Partial<Record<"phone" | "postcode", string>>;

/** What's wrong with the typed details, empty when they can be saved. Characters that never fit a
 * field can't be typed at all (lib/forms/field-rules.ts); this catches what's left: a phone number
 * too short or too long, and a postcode (UK) or ZIP code (PH) that isn't one. */
export function firmDetailsErrors(f: FirmDetailsForm, tenantCode: TenantCode | null): FirmDetailsErrors {
  const errors: FirmDetailsErrors = {};
  const phone = phoneProblem(f.phone);
  if (phone) errors.phone = phone;
  const postcode = postcodeProblem(f.postcode, tenantCode);
  if (postcode) errors.postcode = postcode;
  return errors;
}

export function hasFirmDetailsErrors(f: FirmDetailsForm, tenantCode: TenantCode | null) {
  return Object.keys(firmDetailsErrors(f, tenantCode)).length > 0;
}

/**
 * A firm's name and optional details: onboarding's firm step and the Organization page. The
 * regulator and firm number are UK only; the address country is the site's, so it isn't asked.
 * Each field only takes what fits it (digits for numbers, letters for the city); `checked` shows
 * what's still wrong, once the form has been sent (see firmDetailsErrors).
 */
export function FirmDetailsFields({
  value,
  onChange,
  tenantCode,
  nameError,
  disabled,
  showName = true,
  checked = false,
}: {
  value: FirmDetailsForm;
  onChange: (patch: Partial<FirmDetailsForm>) => void;
  tenantCode: TenantCode | null;
  nameError?: string | null;
  disabled?: boolean;
  /** Off on the Organization page, which edits the name on its own. */
  showName?: boolean;
  /** The form was sent: show what's wrong with the details. */
  checked?: boolean;
}) {
  const { t } = useTranslation("onboarding");
  const { t: tProfile } = useTranslation("profile");
  const uk = tenantCode === "UK";
  const errors = checked ? firmDetailsErrors(value, tenantCode) : {};

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5">
      {showName && (
        <TextField
          label={t("firm.name")}
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          errorText={nameError ?? undefined}
          maxLength={120}
          required
          autoFocus
        />
      )}
      {uk && (
        <>
          <div className="flex flex-col gap-2">
            <FieldLabel id="firm-regulator">{t("firm.regulator")}</FieldLabel>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="firm-regulator">
              {REGULATORS.map((r) => (
                <Pill key={r} selected={value.firmRegulator === r} onClick={() => onChange({ firmRegulator: value.firmRegulator === r ? null : r })}>
                  {tProfile(`clientRequests.regulators.${r}`)}
                </Pill>
              ))}
            </div>
          </div>
          <TextField
            label={t("firm.registrationNumber")}
            helperText={t("firm.registrationNumberHelp")}
            inputMode="numeric"
            value={value.firmRegistrationNumber}
            onChange={(e) => onChange({ firmRegistrationNumber: keepDigits(e.target.value) })}
            maxLength={NUMBER_MAX_DIGITS}
          />
        </>
      )}
      <TextField
        label={t("firm.phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value.phone}
        onChange={(e) => onChange({ phone: keepPhone(e.target.value) })}
        errorText={errors.phone}
        maxLength={24}
      />
      <TextField label={t("firm.addressLine1")} autoComplete="address-line1" value={value.addressLine1} onChange={(e) => onChange({ addressLine1: e.target.value })} maxLength={120} />
      <TextField label={t("firm.addressLine2")} autoComplete="address-line2" value={value.addressLine2} onChange={(e) => onChange({ addressLine2: e.target.value })} maxLength={120} />
      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <TextField label={t("firm.city")} autoComplete="address-level2" value={value.city} onChange={(e) => onChange({ city: keepWords(e.target.value) })} maxLength={80} />
        <TextField
          label={uk ? t("firm.postcodeUK") : t("firm.postcodePH")}
          autoComplete="postal-code"
          inputMode={uk ? "text" : "numeric"}
          value={value.postcode}
          onChange={(e) => onChange({ postcode: uk ? keepUkPostcode(e.target.value) : keepDigits(e.target.value) })}
          errorText={errors.postcode}
          maxLength={uk ? 8 : 4}
        />
      </div>
    </fieldset>
  );
}
