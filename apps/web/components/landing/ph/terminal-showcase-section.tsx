"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

const PANEL_KEYS = ["chat", "redTeam", "audioOverview", "caseReconstruction"] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

const ACCENTS: Record<PanelKey, string> = {
  chat: "from-indigo-500/25",
  redTeam: "from-red-500/25",
  audioOverview: "from-teal-400/25",
  caseReconstruction: "from-brand-gold/25",
};

export function TerminalShowcaseSection() {
  const { t } = useTranslation("landing");

  return (
    <section id="control" className="relative w-full bg-background py-24 px-6 md:px-16">
      <div className="max-w-[760px] mx-auto mb-14 text-center flex flex-col items-center gap-6">
        <h2 className="font-['Libre_Caslon_Text'] text-foreground text-[clamp(36px,4.6vw,58px)] font-normal leading-[1.08]">
          {t("terminal.heading")}
        </h2>
        <p className="text-muted-foreground text-base leading-[1.6] max-w-[440px]">{t("terminal.body")}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/signup"
              className="text-xs tracking-[1.2px] uppercase font-semibold px-6 py-3 rounded-full bg-foreground text-background hover:opacity-85 transition-opacity duration-200"
            >
              {t("terminal.cta")}
            </Link>
          </TooltipTrigger>
          <TooltipContent>Sign up to open the Legal Terminal</TooltipContent>
        </Tooltip>
      </div>

      <div className="max-w-360 mx-auto flex flex-col lg:flex-row gap-4 items-stretch">
        {PANEL_KEYS.map((key) => {
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Link
                  href="/signup"
                  className="group flex-1 min-w-0 min-h-[560px] rounded-3xl overflow-hidden relative bg-card transition-[flex-grow] duration-[420ms] ease-[cubic-bezier(.16,1,.3,1)] hover:flex-[2.4]"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${ACCENTS[key]} via-brand-navy-900 to-brand-navy-950 p-7 flex flex-col`}
                  >
                    <h3 className="font-['Libre_Caslon_Text'] text-white text-[22px]">
                      {t(`terminal.panels.${key}.title`)}
                    </h3>
                    <p className="text-white/85 text-[13px] mt-2">{t(`terminal.panels.${key}.subtitle`)}</p>

                    <div className="mt-5 w-full flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden bg-brand-navy-900 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                      <div className="h-7 shrink-0 bg-brand-navy-950 flex items-center gap-2 px-3">
                        <span className="font-['Libre_Caslon_Text'] text-white text-[11px]">ilovelawyer</span>
                      </div>
                      <div className="flex-1 min-h-0 flex items-center justify-center p-3">
                        <span className="text-[11px] uppercase tracking-[1.5px] text-white/50 font-semibold">
                          {t("terminal.comingSoon")}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>{t(`terminal.panels.${key}.subtitle`)}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}
