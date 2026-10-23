"use client";

import { createContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-provider";

/** Where a step's StepIndicator goes: the shell's top bar, in the same row as the back arrow.
 * Undefined outside a shell (the indicator then stays where it's rendered); null until the bar is
 * in the page. */
export const ProgressSlotContext = createContext<HTMLElement | null | undefined>(undefined);

/** Account setup's page layout: full screen, one centered column, with no brand panel beside it,
 * from the moment the email is verified (choosing Solo or Law firm) through Apply and the wait for
 * approval. Every step looks the same whether it opens from sign-up, a reload, or /onboarding. A top
 * bar holds the back arrow, the step indicator (a StepIndicator anywhere in the step lands there)
 * and the language and theme switches, in one row. */
export function OnboardingShell({
  children,
  onBack,
  wide = false,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  /** A wider column, for a step laid out side by side (the plans). */
  wide?: boolean;
}) {
  const { t } = useTranslation("onboarding");
  const [progressSlot, setProgressSlot] = useState<HTMLElement | null>(null);
  return (
    <ProgressSlotContext.Provider value={progressSlot}>
      <div className="flex h-screen w-full flex-col overflow-y-auto bg-background">
        <header className="sticky top-0 z-20 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4 bg-background px-6 py-5 md:px-10 md:py-6">
          <div className="justify-self-start">
            {/* Only when the step has somewhere to go back to. */}
            {onBack && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onBack}
                    aria-label={t("firm.back")}
                    className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0"
                  >
                    <ArrowLeft size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("firm.back")}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div ref={setProgressSlot} className="min-w-0 max-w-[calc(100vw-10rem)] overflow-x-auto" style={{ fontFamily: "Inter, sans-serif" }} />
          <div className="justify-self-end flex items-center gap-4 text-foreground">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center px-6 pb-10 md:px-10">
          <div className={`w-full ${wide ? "max-w-5xl" : "max-w-lg"} flex flex-col gap-8 my-auto pt-4`} style={{ fontFamily: "Inter, sans-serif" }}>
            {children}
          </div>
        </div>
      </div>
    </ProgressSlotContext.Provider>
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
