"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  AudioLines,
  BookOpen,
  Calendar,
  CheckCircle2,
  FolderOpen,
  GitBranch,
  MessageSquare,
  Mic,
  Network,
  PanelsTopLeft,
  Shield,
  Terminal,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { hasSessionHint, refreshAccessToken } from "@/lib/fetch";

const CAPABILITIES: { Icon: LucideIcon; route: string }[] = [
  { Icon: UserCircle, route: "/homepage/profile" },
  { Icon: Users, route: "/homepage/organization" },
  { Icon: MessageSquare, route: "/homepage" },
  { Icon: FolderOpen, route: "/homepage/case-portfolio" },
  { Icon: PanelsTopLeft, route: "/homepage/case-portfolio" },
  { Icon: Terminal, route: "/homepage/terminal" },
  { Icon: BookOpen, route: "/homepage/library" },
  { Icon: Mic, route: "/homepage/transcription" },
  { Icon: Calendar, route: "/homepage/calendar" },
  { Icon: Network, route: "/homepage/terminal" },
  { Icon: GitBranch, route: "/homepage/terminal" },
  { Icon: Shield, route: "/homepage/terminal" },
  { Icon: AudioLines, route: "/homepage/terminal" },
  { Icon: CheckCircle2, route: "/homepage/terminal" },
  { Icon: AlertTriangle, route: "/homepage/terminal" },
];

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

  const handleEnter = (hoveredIndex: number) => {
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
    <section id="capabilities" className="relative bg-background py-24 px-6 md:px-16">
      <div className="max-w-360 mx-auto">
        <div className="flex items-end justify-between gap-8 pb-16 flex-wrap">
          <div>
            <h2 className="font-['Libre_Caslon_Text'] text-foreground text-[clamp(30px,3.4vw,46px)] font-normal leading-[1.15]">
              {t("capabilities.heading")}
            </h2>
            <p className="text-muted-foreground text-base mt-4 max-w-[560px] leading-[1.6]">
              {t("capabilities.subheading")}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/signup"
                className="shrink-0 border-b-2 border-foreground pb-1.5 hover:opacity-70 transition-opacity duration-200"
              >
                <span className="text-foreground text-xs tracking-[1.2px] uppercase font-semibold">
                  {t("capabilities.explorePlatform")}
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>{t("capabilities.exploreTooltip")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-11">
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
                  className="group flex flex-col items-center gap-3 text-center transition-transform duration-[260ms] ease-[cubic-bezier(.16,1,.3,1)] will-change-transform"
                >
                  <span className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-foreground transition-all duration-200 group-hover:text-brand-gold group-hover:border-brand-gold group-hover:bg-brand-gold/10 group-hover:-translate-y-1 group-hover:scale-[1.06] group-hover:shadow-[0_8px_18px_rgba(201,164,76,0.25)]">
                    <Icon size={22} strokeWidth={1.6} />
                  </span>
                  <span className="text-foreground text-[13px]">{labels[i]}</span>
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
