"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Check, Loader2, User } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth.store";
import { toActiveOrg, toOwnWorkspace } from "@/lib/auth/mutations";
import { apiFetch } from "@/lib/fetch";
import type { PortfolioRecord } from "@/lib/organizations/queries";
import { useChooseSoloMutation } from "@/lib/user/mutations";
import { useCreateOrganizationMutation } from "@/lib/organizations/mutations";
import { useTenantCodeHint } from "@/components/tenant-code-provider";
import { EMPTY_FIRM, FirmDetailsFields, firmDetailsPayload, hasFirmDetailsErrors, type FirmDetailsForm } from "@/components/organization/firm-details-fields";
import {
  setupHeadingClass,
  setupPrimaryButtonClass as primaryButtonClass,
  setupSecondaryButtonClass as secondaryButtonClass,
  setupSubtitleClass,
} from "@/components/onboarding/styles";

type Choice = "solo" | "firm";

/** One option of the choice. Selecting it creates nothing: Continue does. */
function ChoiceCard({
  icon,
  title,
  description,
  selected,
  onSelect,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={`flex w-full cursor-pointer items-start gap-4 rounded-xl border bg-card p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/40"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">{icon}</span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-base font-semibold text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
        aria-hidden="true"
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

/**
 * Shown to a user with no organization and no pending invite: right after email verification (or
 * a first Google sign-in), or on a reload before they had a workspace. They choose:
 * - **Solo practitioner**: no organization is created (ilovelawyer-api's docs/adr/0022). Their work
 *   lives in their own workspace. They can create a firm later from the Organization page; what
 *   they made solo stays theirs, as their portfolio.
 * - **Law firm**: a new organization, with its name and optional details.
 * This is the only required part of account setup: every resource route needs a workspace. The
 * rest (invites, the Lawyer Application) is on /onboarding, once the account is approved.
 */
export type WorkspaceSetupStep = "choose" | "firm";

export function WorkspaceSetup({
  defaultOrgName,
  onDone,
  step: controlledStep,
  onStepChange,
}: {
  defaultOrgName: string;
  onDone: () => void;
  /** Pass both to drive the step from outside, e.g. the sign-up page's back arrow, which then
   * returns from the firm form to the choice instead of leaving the page. */
  step?: WorkspaceSetupStep;
  onStepChange?: (step: WorkspaceSetupStep) => void;
}) {
  const { t } = useTranslation("onboarding");
  const setOrganization = useAuthStore((s) => s.setOrganization);
  const tenantCode = useTenantCodeHint();
  const createOrgMutation = useCreateOrganizationMutation();
  const chooseSoloMutation = useChooseSoloMutation();
  const [ownStep, setOwnStep] = useState<WorkspaceSetupStep>("choose");
  const step = controlledStep ?? ownStep;
  const setStep = onStepChange ?? setOwnStep;
  // Picking a card only selects it, so a mis-click costs nothing: Continue creates the workspace
  // (Solo) or opens the firm's details (Law firm, whose Back returns here with it still selected).
  // Solo is preselected: most sign-ups are one lawyer, and it's the choice that's easy to change
  // later (a firm can be created from the Organization page).
  const [choice, setChoice] = useState<Choice>("solo");
  const [firm, setFirm] = useState<FirmDetailsForm>(EMPTY_FIRM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finish(org: Parameters<typeof toActiveOrg>[0]) {
    setOrganization(toActiveOrg(org));
    onDone();
  }

  function chooseSolo() {
    setError(null);
    chooseSoloMutation.mutate(undefined, {
      onSuccess: async (me) => {
        try {
          // Their own workspace's site comes from the account (it has no organization).
          const portfolio = await apiFetch<PortfolioRecord>("/api/organizations/portfolio");
          setOrganization(toOwnWorkspace(portfolio, me.name ?? defaultOrgName));
          onDone();
        } catch (err) {
          setError((err as Error).message);
        }
      },
      onError: (err) => setError((err as Error).message),
    });
  }

  function createFirm(e: React.FormEvent) {
    e.preventDefault();
    const name = firm.name.trim();
    setChecked(true);
    if (!name) {
      setNameError(t("firm.nameRequired"));
      return;
    }
    setNameError(null);
    if (hasFirmDetailsErrors(firm, tenantCode)) return;
    setError(null);
    createOrgMutation.mutate(
      { name, ...firmDetailsPayload(firm, tenantCode) },
      {
        onSuccess: (org) => finish({ ...org, role: "OWNER" }),
        onError: (err) => setError((err as Error).message),
      }
    );
  }

  const pending = createOrgMutation.isPending || chooseSoloMutation.isPending;

  if (step === "firm")
    return (
      <form onSubmit={createFirm} className="flex flex-col gap-6" style={{ fontFamily: "Inter, sans-serif" }}>
        <div className="flex flex-col gap-1">
          <h1 className={setupHeadingClass}>{t("firm.title")}</h1>
          <p className={setupSubtitleClass}>{t("firm.subtitle")}</p>
        </div>
        <FirmDetailsFields value={firm} onChange={(patch) => setFirm((f) => ({ ...f, ...patch }))} tenantCode={tenantCode} nameError={nameError} disabled={pending} checked={checked} />
        {error && (
          <p className="text-red-500 text-sm" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {pending ? t("firm.creating") : t("firm.create")}
          </button>
          <button type="button" disabled={pending} onClick={() => setStep("choose")} className={secondaryButtonClass}>
            {t("firm.back")}
          </button>
        </div>
      </form>
    );

  return (
    <div className="flex flex-col gap-6" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="flex flex-col gap-1">
        <h1 className={setupHeadingClass}>{t("choose.title")}</h1>
        <p className={setupSubtitleClass}>{t("choose.subtitle")}</p>
      </div>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("choose.title")}>
        <ChoiceCard
          icon={<User className="h-5 w-5" aria-hidden="true" />}
          title={t("choose.soloTitle")}
          description={t("choose.soloDescription")}
          selected={choice === "solo"}
          onSelect={() => {
            setError(null);
            setChoice("solo");
          }}
          disabled={pending}
        />
        <ChoiceCard
          icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
          title={t("choose.firmTitle")}
          description={t("choose.firmDescription")}
          selected={choice === "firm"}
          onSelect={() => {
            setError(null);
            setChoice("firm");
          }}
          disabled={pending}
        />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => (choice === "solo" ? chooseSolo() : setStep("firm"))}
        className={primaryButtonClass}
      >
        {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        {pending ? t("choose.settingUp") : t("choose.continue")}
      </button>
      {error && (
        <div className="flex flex-col gap-1" role="alert">
          <p className="text-foreground text-sm font-semibold">{t("choose.failed")}</p>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
