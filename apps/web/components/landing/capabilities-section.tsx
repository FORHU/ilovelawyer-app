"use client";

import { useRef } from "react";
import type { SVGProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { hasSessionHint, refreshAccessToken } from "@/lib/fetch";
import { featureIcons } from "@/components/landing/feature-icons";
import { useNoHover } from "@/lib/landing/use-no-hover";

// Handoff icon set, one per tile, in the same order as the `capabilities.items` i18n array.
const CAPABILITIES: { Icon: React.ElementType<SVGProps<SVGSVGElement>>; route: string }[] = [
  { Icon: featureIcons.accountsSignIn, route: "/homepage/profile" },
  { Icon: featureIcons.firmsTeams, route: "/homepage/organization" },
  { Icon: featureIcons.aiLegalConsultation, route: "/homepage" },
  { Icon: featureIcons.caseFiles, route: "/homepage/case-portfolio" },
  { Icon: featureIcons.caseWorkspace, route: "/homepage/case-portfolio" },
  { Icon: featureIcons.legalTerminal, route: "/homepage/terminal" },
  { Icon: featureIcons.researchLibrary, route: "/homepage/library" },
  { Icon: featureIcons.transcription, route: "/homepage/transcription" },
  { Icon: featureIcons.documentUpload, route: "/homepage/case-portfolio" },
  { Icon: featureIcons.calendar, route: "/homepage/calendar" },
  { Icon: featureIcons.visualStrategyMap, route: "/homepage/terminal" },
  { Icon: featureIcons.evidenceTimeline, route: "/homepage/terminal" },
  { Icon: featureIcons.redTeam, route: "/homepage/terminal" },
  { Icon: featureIcons.audioOverview, route: "/homepage/terminal" },
  { Icon: featureIcons.citationChecking, route: "/homepage/terminal" },
  { Icon: featureIcons.contradictionScan, route: "/homepage/terminal" },
];

// The last row holds 4 tiles in a 6-column grid; starting it at column 2 (instead of 1) puts it one
// column in from the left, so the four sit centred under the six above at the desktop layout.
const LAST_ROW_START = 12;

const REPEL_RADIUS = 130;
const REPEL_MAX_PUSH = 16;

function loginHref(route: string): string {
  return `/login?next=${encodeURIComponent(route)}`;
}

export function CapabilitiesSection() {
  const { t } = useTranslation("landing");
  const router = useRouter();
  const labels = t("capabilities.items", { returnObjects: true }) as string[];
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const noHover = useNoHover();

  const handleEnter = (hoveredIndex: number) => {
    // Handoff: disable the magnetic hover on touch — devices with no real hover capability
    // fire mouseenter on tap, which would otherwise leave neighboring tiles permanently
    // shifted until another tile is tapped.
    if (noHover) return;
    const hovered = cardRefs.current[hoveredIndex];
    if (!hovered) return;
    const hr = hovered.getBoundingClientRect();
    const hx = hr.left + hr.width / 2;
    const hy = hr.top + hr.height / 2;
    cardRefs.current.forEach((card, i) => {
      if (!card || i === hoveredIndex) return;
      const cr = card.getBoundingClientRect();
      const cx = cr.left + cr.width / 2;
      const cy = cr.top + cr.height / 2;
      const dx = cx - hx;
      const dy = cy - hy;
      const dist = Math.hypot(dx, dy);
      if (dist < REPEL_RADIUS && dist > 0.01) {
        const push = (1 - dist / REPEL_RADIUS) * REPEL_MAX_PUSH;
        card.style.transform = `translate(${((dx / dist) * push).toFixed(1)}px, ${((dy / dist) * push).toFixed(1)}px)`;
      }
    });
  };

  const handleLeave = () => {
    cardRefs.current.forEach((card) => {
      if (card) card.style.transform = "";
    });
  };

  // Logged-out visitors go through sign-in/sign-up (the tile's `href`, so it still works
  // with JS disabled) with `next` pointing back at the real feature; a visitor who's
  // already got a live session skips that detour and lands on the feature directly.
  const handleClick = async (e: React.MouseEvent, route: string) => {
    e.preventDefault();
    if (hasSessionHint()) {
      try {
        await refreshAccessToken();
        router.push(route);
        return;
      } catch {
        // fall through — hint was stale, visitor isn't actually logged in
      }
    }
    router.push(loginHref(route));
  };

  return (
    <section id="capabilities" className="relative bg-brand-navy-950 py-24 px-6 md:px-16">
      <div className="max-w-360 mx-auto">
        <div className="flex flex-col items-center text-center gap-5 pb-14">
          <h2 className="font-display text-white text-[clamp(30px,3.4vw,46px)] font-normal leading-[1.15] tracking-[-0.02em] max-w-[900px]">
            {t("capabilities.heading")}
          </h2>
          <p className="text-white text-[15px] leading-[1.5] max-w-[640px] text-balance">{t("capabilities.subheading")}</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-11 max-w-[1176px] mx-auto">
          {CAPABILITIES.map(({ Icon, route }, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Link
                  href={loginHref(route)}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  onMouseEnter={() => handleEnter(i)}
                  onMouseLeave={handleLeave}
                  onClick={(e) => void handleClick(e, route)}
                  className={`group flex flex-col items-center gap-3 text-center transition-transform duration-[260ms] ease-[cubic-bezier(.16,1,.3,1)] will-change-transform rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-950 ${i === LAST_ROW_START ? "lg:col-start-2" : ""}`}
                >
                  <span className="w-12 h-12 rounded-full border border-white/35 flex items-center justify-center text-white transition-all duration-200 group-hover:text-brand-gold group-hover:border-brand-gold group-hover:bg-brand-gold/10 group-hover:-translate-y-1 group-hover:scale-[1.06] group-hover:shadow-[0_8px_18px_rgba(201,164,76,0.25)]">
                    <Icon width={22} height={22} strokeWidth={1.6} />
                  </span>
                  <span className="text-white text-[13px] leading-[1.2]">{labels[i]}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>{t("capabilities.tileTooltip")}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </section>
  );
}
