"use client";

import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-provider";

/** Account setup's page layout: the sign-in page's split screen (brand panel left, a narrow form
 * column right), so every step, from choosing Solo or Firm through Apply, looks the same whether
 * it opens from sign-up, a reload, or /onboarding. */
export function OnboardingShell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  const { t } = useTranslation("onboarding");
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AuthBrandPanel />
      <div className="relative bg-background flex flex-col items-center justify-start px-8 md:px-26.5 py-10 flex-1 overflow-y-auto">
        {/* Same place and look as the sign-up page's back arrow. Only when the step has somewhere
            to go back to. */}
        {onBack && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onBack}
                aria-label={t("firm.back")}
                className="absolute top-6 left-6 md:top-8 md:left-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 z-20"
              >
                <ArrowLeft size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("firm.back")}</TooltipContent>
          </Tooltip>
        )}
        <div className="absolute top-6 right-6 md:top-8 md:right-10 flex items-center gap-4 text-foreground z-20">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md flex flex-col gap-8 my-auto pt-12" style={{ fontFamily: "Inter, sans-serif" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Setup's loading state: the same layout with a small spinner where the step will be, so moving
 * between steps (and the checks before them) never flashes the full-screen loader. */
export function OnboardingLoading() {
  return (
    <OnboardingShell>
      <div className="flex justify-center py-16 text-muted-foreground" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    </OnboardingShell>
  );
}
