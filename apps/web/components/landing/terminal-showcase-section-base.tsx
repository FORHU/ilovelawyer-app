"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { hasSessionHint, refreshAccessToken } from "@/lib/fetch";

// PH and UK render identical markup (see hero-section-base.tsx for why this is one
// component instead of two hand-copied files) — this section has no _UK i18n variants at
// all, unlike hero/quotes, so it takes no tenant prop.

const TERMINAL_ROUTE = "/homepage/terminal";
const loginHref = `/login?next=${encodeURIComponent(TERMINAL_ROUTE)}`;

const PANEL_KEYS = ["chat", "redTeam", "audioOverview", "caseReconstruction"] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

// Handoff §5 texture assets (M1), mapped where the panel's real title matches a handoff
// card exactly ("chat" ships as "AI Legal Assistant", "redTeam" as "Red Team" — both are
// the handoff's own card names). "audioOverview" and "caseReconstruction" have no handoff
// counterpart (the product ships different panels than the mockup's four), so they take
// the two remaining textures for visual variety, not because of any content correspondence.
const TEXTURES: Record<PanelKey, string> = {
  chat: "/landing/textures/texture-teal.jpg",
  redTeam: "/landing/textures/texture-blue.jpg",
  audioOverview: "/landing/textures/texture-dots.jpg",
  caseReconstruction: "/landing/textures/texture-gold.jpg",
};

export function TerminalShowcaseSectionBase() {
  const { t } = useTranslation("landing");
  const router = useRouter();

  const handleCtaClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasSessionHint()) {
      try {
        await refreshAccessToken();
        router.push(TERMINAL_ROUTE);
        return;
      } catch {
        // fall through — hint was stale, visitor isn't actually logged in
      }
    }
    router.push(loginHref);
  };

  return (
    <section id="control" className="relative w-full bg-brand-navy-950 py-24 px-6 md:px-16">
      <div className="max-w-[760px] mx-auto mb-14 text-center flex flex-col items-center gap-6">
        <h2 className="font-display text-white text-[clamp(36px,4.6vw,58px)] font-normal leading-[1.08]">
          {t("terminal.heading")}
        </h2>
        <p className="text-white/75 text-base leading-[1.6] max-w-[440px]">{t("terminal.body")}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={loginHref}
              onClick={(e) => void handleCtaClick(e)}
              className="text-xs tracking-[1.2px] uppercase font-semibold px-6 py-3 rounded-full bg-white text-[#0b0b0b] hover:opacity-85 transition-opacity duration-200"
            >
              {t("terminal.cta")}
            </Link>
          </TooltipTrigger>
          <TooltipContent>{t("capabilities.tileTooltip")}</TooltipContent>
        </Tooltip>
      </div>

      <div className="max-w-360 mx-auto flex flex-col lg:flex-row gap-4 items-stretch">
        {PANEL_KEYS.map((key) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Link
                href="/signup"
                className="group flex-1 min-w-0 min-h-[480px] rounded-3xl overflow-hidden relative bg-cover bg-center transition-[flex-grow] duration-[420ms] ease-[cubic-bezier(.16,1,.3,1)] hover:flex-[2.4]"
                style={{ backgroundImage: `url('${TEXTURES[key]}')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70 p-7 flex flex-col">
                  <h3 className="font-display text-white text-[22px] [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
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
        ))}
      </div>
    </section>
  );
}
