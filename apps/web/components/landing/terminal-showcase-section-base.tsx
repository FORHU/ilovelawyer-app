"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { hasSessionHint, refreshAccessToken } from "@/lib/fetch";
import { TerminalMockWindow, type TerminalMockKey } from "@/components/landing/terminal-mock-window";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// PH and UK render identical markup (see hero-section-base.tsx for why this is one
// component instead of two hand-copied files), differing only in the sample case shown inside
// each miniature terminal window (an i18next `_UK` context on `terminal.mocks`).

const TERMINAL_ROUTE = "/homepage/terminal";
const loginHref = `/login?next=${encodeURIComponent(TERMINAL_ROUTE)}`;

// One card per handoff pane, each with its own texture.
const PANELS: { key: TerminalMockKey; texture: string }[] = [
  { key: "caseSummary", texture: "/landing/textures/texture-dots.jpg" },
  { key: "evidenceTimeline", texture: "/landing/textures/texture-gold.jpg" },
  { key: "redTeam", texture: "/landing/textures/texture-blue.jpg" },
  { key: "chat", texture: "/landing/textures/texture-teal.jpg" },
];

export function TerminalShowcaseSectionBase({ tenantCode }: { tenantCode: TenantCode }) {
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
              className="text-xs tracking-[1.2px] uppercase font-semibold px-6 py-3 rounded-full bg-white text-[#0b0b0b] hover:opacity-85 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]"
            >
              {t("terminal.cta")}
            </Link>
          </TooltipTrigger>
          <TooltipContent>{t("capabilities.tileTooltip")}</TooltipContent>
        </Tooltip>
      </div>

      <div className="max-w-360 mx-auto flex flex-col lg:flex-row gap-4 items-stretch">
        {PANELS.map(({ key, texture }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Link
                href="/signup"
                className="group flex-1 min-w-0 min-h-[480px] rounded-3xl overflow-hidden relative bg-cover bg-center transition-[flex-grow] duration-[420ms] ease-[cubic-bezier(.16,1,.3,1)] hover:flex-[2.4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]"
                style={{ backgroundImage: `url('${texture}')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70 px-5 py-7">
                  <h3 className="font-display text-white text-[22px] [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
                    {t(`terminal.panels.${key}.title`)}
                  </h3>
                  <p className="text-white/85 text-[13px] leading-[1.5] mt-2 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
                    {t(`terminal.panels.${key}.subtitle`)}
                  </p>
                </div>
                <TerminalMockWindow mock={key} tenantCode={tenantCode} />
              </Link>
            </TooltipTrigger>
            <TooltipContent>{t(`terminal.panels.${key}.subtitle`)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </section>
  );
}
