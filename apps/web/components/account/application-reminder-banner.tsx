"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { BadgeCheck, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { LAWYER_APPLICATION_SECTION_ID } from "@/components/account/client-requests-settings";
import { isFeatureEnabled } from "@/config/tenant-codes/capabilities";
import { useClientRequestProfileQuery } from "@/lib/client-requests/profile";
import { useAuthStore } from "@/lib/store/auth.store";

const DISMISS_KEY = "ilovelawyer-app:application-reminder-dismissed-until";
const DISMISS_DAYS = 7;

/** Storage can be unavailable (private mode, blocked site data); the banner then just shows. */
function dismissedUntil(): number {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * A slim reminder on the homepage for a lawyer who hasn't submitted their Lawyer Application (they
 * chose Later at onboarding, or never finished it). Links to the Profile page's section. Dismissed
 * for 7 days in this browser. The protected layout keeps pending accounts out of the homepage, so
 * it never shows to one.
 */
export function ApplicationReminderBanner() {
  const { t } = useTranslation("onboarding");
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode);
  const applies = isFeatureEnabled(tenantCode, "lawyerApplication");
  const { data: profile } = useClientRequestProfileQuery(applies);
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && dismissedUntil() > Date.now());

  if (!applies || hidden || profile?.verification.status !== "UNSUBMITTED") return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      // Not remembered across reloads, but hidden for now.
    }
    setHidden(true);
  }

  return (
    <div className="shrink-0 border-b border-border bg-brand-gold/10 px-4 md:px-8 py-2.5 flex items-center gap-3 text-[13px]" role="status">
      <BadgeCheck className="h-4 w-4 shrink-0 text-foreground/70" aria-hidden="true" />
      <p className="flex-1 min-w-0 text-foreground">{t(`banner.${profile.country}`)}</p>
      <Link href={`/homepage/profile#${LAWYER_APPLICATION_SECTION_ID}`} className="shrink-0 font-semibold text-foreground underline underline-offset-2 hover:opacity-80">
        {t("banner.action")}
      </Link>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("banner.dismiss")}
            className="shrink-0 cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("banner.dismiss")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
