"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AudioLines,
  BookOpen,
  Calendar,
  CheckCircle2,
  FolderOpen,
  GitBranch,
  Globe,
  Languages,
  MessageSquare,
  Mic,
  Network,
  PanelsTopLeft,
  Shield,
  Terminal,
  Upload,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

const ICONS: LucideIcon[] = [
  UserCircle,
  Users,
  Globe,
  MessageSquare,
  FolderOpen,
  PanelsTopLeft,
  Terminal,
  BookOpen,
  Mic,
  Upload,
  Calendar,
  Network,
  GitBranch,
  Shield,
  AudioLines,
  CheckCircle2,
  AlertTriangle,
  Languages,
];

const REPEL_RADIUS = 130;
const REPEL_MAX_PUSH = 16;

export function CapabilitiesSection() {
  const { t } = useTranslation("landing");
  const labels = t("capabilities.items", { returnObjects: true }) as string[];
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

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
            <TooltipContent>Sign up to explore every feature</TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-11">
          {ICONS.map((Icon, i) => (
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={handleLeave}
              className="group flex flex-col items-center gap-3 text-center transition-transform duration-[260ms] ease-[cubic-bezier(.16,1,.3,1)] will-change-transform"
            >
              <span className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-foreground transition-all duration-200 group-hover:text-brand-gold group-hover:border-brand-gold group-hover:bg-brand-gold/10 group-hover:-translate-y-1 group-hover:scale-[1.06] group-hover:shadow-[0_8px_18px_rgba(201,164,76,0.25)]">
                <Icon size={22} strokeWidth={1.6} />
              </span>
              <span className="text-foreground text-[13px]">{labels[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
