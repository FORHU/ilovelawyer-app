"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth.store";
import { toActiveOrg } from "@/lib/auth/mutations";
import { useCreateOrganizationMutation } from "@/lib/organizations/mutations";

const primaryButtonClass =
  "w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[1.6px] uppercase font-semibold py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed";

/** Shown to a user with no organization and no pending invite (a new signup, or one who reloaded
 * before having a workspace). There is no choice to make: it sets up their private personal
 * workspace — what onboarding's old "Skip for now" did — and moves on. Creating or joining an
 * organization later, from the Organization page, still works; this workspace then stays on as
 * their portfolio. Every resource route needs some workspace, so this can't simply be skipped. */
export function WorkspaceSetup({ defaultOrgName, onDone }: { defaultOrgName: string; onDone: () => void }) {
  const { t } = useTranslation("auth");
  const setOrganization = useAuthStore((s) => s.setOrganization);
  const createOrgMutation = useCreateOrganizationMutation();
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs mount effects twice in dev; the API is idempotent for personal workspaces,
  // but there's no reason to send the request twice.
  const startedRef = useRef(false);

  function setUp() {
    setError(null);
    createOrgMutation.mutate(
      { name: defaultOrgName || "Personal workspace", personal: true },
      {
        onSuccess: (org) => {
          setOrganization(toActiveOrg({ ...org, role: "OWNER" }));
          onDone();
        },
        onError: (err) => setError((err as Error).message),
      }
    );
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setUp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!error)
    return (
      <p
        className="text-muted-foreground text-base flex items-center justify-center gap-2"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        {t("workspace.settingUp")}
      </p>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-foreground text-base font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
          {t("workspace.setupFailed")}
        </p>
        <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
          {error}
        </p>
      </div>
      <button type="button" disabled={createOrgMutation.isPending} onClick={setUp} className={primaryButtonClass}>
        {createOrgMutation.isPending ? t("workspace.settingUp") : t("workspace.retry")}
      </button>
    </div>
  );
}
