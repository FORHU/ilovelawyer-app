"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { FirmDetailsFields, firmDetailsPayload, firmFormFromOrganization, type FirmDetailsForm } from "@/components/organization/firm-details-fields";
import { setupHeadingClass, setupPrimaryButtonClass, setupSubtitleClass } from "@/components/onboarding/styles";
import { useUpdateOrganizationMutation } from "@/lib/organizations/mutations";
import { useOrganizationQuery, type OrganizationRecord } from "@/lib/organizations/queries";
import { useAuthStore, type ActiveOrganization } from "@/lib/store/auth.store";

/**
 * Onboarding's Firm step, reached by going back from Invite: the firm already exists (it was
 * created at the choice), so this edits its name and details and moves on.
 */
export function FirmStep({ organization, onDone }: { organization: ActiveOrganization; onDone: () => void }) {
  const query = useOrganizationQuery(organization.id);
  if (!query.data)
    return (
      <div className="flex justify-center py-16 text-muted-foreground" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  return <FirmForm org={query.data} onDone={onDone} />;
}

function FirmForm({ org, onDone }: { org: OrganizationRecord; onDone: () => void }) {
  const { t } = useTranslation("onboarding");
  const setOrganization = useAuthStore((s) => s.setOrganization);
  const active = useAuthStore((s) => s.organization);
  const update = useUpdateOrganizationMutation(org.id);
  const [form, setForm] = useState<FirmDetailsForm>(() => firmFormFromOrganization(org));
  const [nameError, setNameError] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setNameError(t("firm.nameRequired"));
      return;
    }
    setNameError(null);
    update.mutate(
      { name, ...firmDetailsPayload(form, org.tenant.code) },
      {
        onSuccess: (next) => {
          // The header and the Invite step read the name from the active organization.
          if (active && active.id === next.id) setOrganization({ ...active, name: next.name });
          onDone();
        },
      }
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className={setupHeadingClass}>{t("firm.title")}</h1>
        <p className={setupSubtitleClass}>{t("firm.subtitle")}</p>
      </div>
      <FirmDetailsFields
        value={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        tenantCode={org.tenant.code}
        nameError={nameError}
        disabled={update.isPending}
      />
      {update.isError && (
        <p className="text-red-500 text-sm" role="alert">
          {(update.error as Error).message}
        </p>
      )}
      <button type="submit" disabled={update.isPending} className={setupPrimaryButtonClass}>
        {update.isPending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        {update.isPending ? t("firm.saving") : t("firm.saveContinue")}
      </button>
    </form>
  );
}
