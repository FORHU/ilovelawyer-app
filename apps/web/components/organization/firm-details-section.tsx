"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { FirmDetailsFields, firmDetailsPayload, firmFormFromOrganization, type FirmDetailsForm } from "@/components/organization/firm-details-fields";
import { useUpdateOrganizationMutation } from "@/lib/organizations/mutations";
import { useOrganizationQuery, type OrganizationRecord } from "@/lib/organizations/queries";

/** The Organization page's firm details, for Owners and Admins (the API's update route is theirs).
 * The name is edited in the page header, so it isn't repeated here. */
export function FirmDetailsSection({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation("onboarding");
  const query = useOrganizationQuery(organizationId);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/[0.06] overflow-hidden">
      <div className="px-6 md:px-8 py-5 border-b border-border">
        <h2 className="font-['Libre_Caslon_Text',serif] text-[20px] text-foreground">{t("firm.sectionTitle")}</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">{t("firm.sectionSubtitle")}</p>
      </div>
      {query.isLoading && (
        <div className="px-6 md:px-8 py-6 flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      )}
      {query.data && <FirmDetailsForm org={query.data} />}
    </section>
  );
}

function FirmDetailsForm({ org }: { org: OrganizationRecord }) {
  const { t } = useTranslation("onboarding");
  const update = useUpdateOrganizationMutation(org.id);
  const [form, setForm] = useState<FirmDetailsForm>(() => firmFormFromOrganization(org));
  const [saved, setSaved] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(firmDetailsPayload(form, org.tenant.code), {
      onSuccess: (next) => {
        setForm(firmFormFromOrganization(next));
        setSaved(true);
      },
    });
  }

  return (
    <form onSubmit={save} className="px-6 md:px-8 py-6 flex flex-col gap-5">
      <FirmDetailsFields
        value={form}
        onChange={(patch) => {
          setSaved(false);
          setForm((f) => ({ ...f, ...patch }));
        }}
        tenantCode={org.tenant.code}
        disabled={update.isPending}
        showName={false}
      />
      <div className="flex items-center justify-end gap-3 flex-wrap">
        {update.isError && (
          <p className="text-[13px] text-red-600 mr-auto" role="alert">
            {(update.error as Error).message}
          </p>
        )}
        {saved && !update.isPending && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" aria-hidden="true" />
            {t("firm.saved")}
          </span>
        )}
        <Button type="submit" variant="outline" disabled={update.isPending}>
          {update.isPending ? t("firm.saving") : t("firm.save")}
        </Button>
      </div>
    </form>
  );
}
