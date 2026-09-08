"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { getTenantCodeConfig } from "@/config/tenant-codes";

const PANEL_KEYS = ["caseWorkspace", "redTeam", "audioOverview", "caseReconstruction"] as const;
const textures = getTenantCodeConfig("PH").landingAssets.terminalPanels;

export function TerminalShowcaseSection() {
  const { t } = useTranslation("landing");
  const panels = PANEL_KEYS.map((key) => ({
    key,
    texture: textures[key],
    lines: t(`terminal.panels.${key}.lines`, { returnObjects: true }) as [string, string],
  }));

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
        {panels.map((panel) => (
          <Tooltip key={panel.key}>
            <TooltipTrigger asChild>
              <Link
                href="/signup"
                className="group flex-1 min-w-0 min-h-[420px] rounded-3xl overflow-hidden relative bg-card transition-[flex-grow] duration-[420ms] ease-[cubic-bezier(.16,1,.3,1)] hover:flex-[2.4]"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center p-7 flex flex-col"
                  style={{ backgroundImage: `url('${panel.texture}')` }}
                >
                  <h3 className="font-['Libre_Caslon_Text'] text-white text-[22px] [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
                    {t(`terminal.panels.${panel.key}.title`)}
                  </h3>
                  <p className="text-white/85 text-[13px] mt-2 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
                    {t(`terminal.panels.${panel.key}.subtitle`)}
                  </p>

                  <div className="mt-auto self-start w-[85%] max-w-[260px] rounded-xl overflow-hidden bg-brand-navy-900 shadow-[0_20px_40px_rgba(0,0,0,0.4)] opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <div className="h-7 bg-brand-navy-950 flex items-center gap-2 px-3">
                      <span className="font-['Libre_Caslon_Text'] text-white text-[11px]">ilovelawyer</span>
                    </div>
                    <div className="p-3 flex flex-col gap-1.5">
                      {panel.lines.map((line) => (
                        <p key={line} className="text-[11px] text-white/80 leading-snug">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent>{t(`terminal.panels.${panel.key}.subtitle`)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </section>
  );
}
