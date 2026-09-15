"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

// UK-only design — see uk/hero-section.tsx for why the context is hardcoded.
const tCtx = { context: "UK" };

const PANEL_KEYS = ["chat", "redTeam", "audioOverview", "caseReconstruction"] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

const ACCENTS: Record<PanelKey, string> = {
  chat: "from-indigo-500/25",
  redTeam: "from-red-500/25",
  audioOverview: "from-teal-400/25",
  caseReconstruction: "from-brand-gold/25",
};

const RECONSTRUCTION_TABS = ["Narrative", "Scenes", "Storyboard"] as const;
const WAVEFORM_HEIGHTS = [30, 55, 80, 45, 100, 65, 40, 90, 50, 70, 35, 60];

type RelatedCase = { title: string; citation: string; vetted: boolean };

export function UkTerminalShowcaseSection() {
  const { t } = useTranslation("landing");
  const topCitation = (t("consultation.relatedCasesItems", { ...tCtx, returnObjects: true }) as RelatedCase[])[0];

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
          const lines =
            key === "redTeam" || key === "audioOverview" || key === "caseReconstruction"
              ? (t(`terminal.panels.${key}.lines`, { ...tCtx, returnObjects: true }) as [string, string])
              : undefined;

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
                      <div className="flex-1 min-h-0 flex flex-col p-3">
                        {key === "chat" && (
                          <div className="flex-1 min-h-0 flex flex-col justify-center gap-2.5">
                            <p className="self-end max-w-[85%] rounded-lg rounded-br-sm bg-white/15 text-white text-[11px] px-2.5 py-1.5 leading-snug">
                              {t("terminal.panels.chat.question", tCtx)}
                            </p>
                            <p className="self-start max-w-[92%] rounded-lg rounded-bl-sm bg-white/[0.06] text-white/80 text-[11px] px-2.5 py-1.5 leading-snug">
                              {t("terminal.panels.chat.answer", tCtx)}
                            </p>
                            {topCitation && (
                              <div className="self-start flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/70">
                                {topCitation.vetted && <span className="text-emerald-300">✓</span>}
                                <span className="truncate max-w-[140px]">{topCitation.title}</span>
                                <span className="text-white/40">·</span>
                                <span>{topCitation.citation}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {key === "redTeam" && lines && (
                          <div className="flex-1 min-h-0 flex flex-col justify-center gap-2.5">
                            <span className="text-[10px] uppercase tracking-wide text-red-300/90 font-semibold">
                              {lines[0]}
                            </span>
                            {lines[1]
                              .split(". ")
                              .map((clause) => clause.replace(/\.$/, "").trim())
                              .filter(Boolean)
                              .map((clause) => (
                                <div key={clause} className="flex items-start gap-2 border-l-2 border-red-400/70 pl-2.5">
                                  <span className="text-[11px] text-white/80 leading-snug">{clause}</span>
                                </div>
                              ))}
                          </div>
                        )}

                        {key === "audioOverview" && lines && (
                          <div className="flex-1 min-h-0 flex flex-col justify-center gap-2">
                            <span className="text-[11px] text-white/70 leading-snug">{lines[0]}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="flex items-center gap-1 text-[9px] pl-0.5 pr-1.5 py-0.5 rounded-full bg-teal-400/20 text-teal-200">
                                <span className="size-3.5 rounded-full bg-teal-400/40 flex items-center justify-center text-[8px]">
                                  A
                                </span>
                                Host A
                              </span>
                              <span className="flex items-center gap-1 text-[9px] pl-0.5 pr-1.5 py-0.5 rounded-full bg-teal-400/20 text-teal-200">
                                <span className="size-3.5 rounded-full bg-teal-400/40 flex items-center justify-center text-[8px]">
                                  B
                                </span>
                                Host B
                              </span>
                            </div>
                            <div className="flex items-end gap-[3px] h-6">
                              {WAVEFORM_HEIGHTS.map((h, i) => (
                                <div
                                  key={i}
                                  className={`w-[3px] rounded-full ${i < 4 ? "bg-teal-300" : "bg-white/20"}`}
                                  style={{ height: `${h}%` }}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] text-white/60 tabular-nums">{lines[1]}</span>
                          </div>
                        )}

                        {key === "caseReconstruction" && lines && (
                          <div className="flex-1 min-h-0 flex flex-col gap-3">
                            <div className="flex gap-1">
                              {RECONSTRUCTION_TABS.map((tab) => (
                                <span
                                  key={tab}
                                  className={`text-[9px] px-2 py-1 rounded-full ${
                                    tab === "Storyboard" ? "bg-brand-gold/90 text-brand-navy-950" : "bg-white/10 text-white/60"
                                  }`}
                                >
                                  {tab}
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-1.5">
                              {[0, 1, 2].map((i) => (
                                <div key={i} className="h-14 flex-1 rounded-md bg-gradient-to-br from-white/15 to-white/5" />
                              ))}
                            </div>
                            <p className="text-[11px] text-white/80 italic leading-snug">
                              {t("terminal.panels.caseReconstruction.narrativeSnippet", tCtx)}
                            </p>
                            <span className="text-[10px] text-white/60 leading-snug mt-auto">{lines[1]}</span>
                          </div>
                        )}
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
