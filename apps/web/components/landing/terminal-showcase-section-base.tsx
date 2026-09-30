"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { hasSessionHint, refreshAccessToken } from "@/lib/fetch";
import { TerminalMockWindow } from "@/components/landing/terminal-mock-window";
import {
  PANEL_CATEGORIES,
  PANEL_TEXTURES,
  orderForCategory,
  panelsForTenant,
  type LandingPanel,
  type PanelCategory,
} from "@/components/landing/terminal-panel-cards";
import { PANEL_TITLES } from "@/lib/terminal/panel-titles";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

// PH and UK render identical markup (see hero-section-base.tsx for why this is one
// component instead of two hand-copied files), differing only in the sample case shown inside
// each miniature terminal window (`_UK` variants of `terminal.mocks` / `terminal.samples`) and
// in the panes offered (Citation Map is Philippines-only — see terminal-panel-cards.ts).

const TERMINAL_ROUTE = "/homepage/terminal";
const loginHref = `/login?next=${encodeURIComponent(TERMINAL_ROUTE)}`;

export function TerminalShowcaseSectionBase({ tenantCode }: { tenantCode: TenantCode }) {
  const { t } = useTranslation("landing");
  const router = useRouter();
  const panels = useMemo(() => panelsForTenant(tenantCode), [tenantCode]);

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
        <p className="text-white/75 text-base leading-[1.6] max-w-[440px]">{t("terminal.body", { count: panels.length })}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={loginHref}
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => void handleCtaClick(e)}
              className="text-xs tracking-[1.2px] uppercase font-semibold px-6 py-3 rounded-full bg-white text-[#0b0b0b] hover:opacity-85 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]"
            >
              {t("terminal.cta")}
            </Link>
          </TooltipTrigger>
          <TooltipContent>{t("capabilities.tileTooltip")}</TooltipContent>
        </Tooltip>
      </div>

      <PanelCarousel panels={panels} tenantCode={tenantCode} />
    </section>
  );
}

// ── Panel carousel (handoff v3 "#control" marquee) ────────────────────────────
// Desktop: an endless strip moved by a rAF loop (translate3d), not a CSS animation, so its
// speed can ease — to a stop while hovered, and to ±FAST_FORWARD while an edge arrow is hovered.
// The set is repeated to at least MIN_SET cards, then doubled, and the offset wraps at one set's
// width, so the seam is never visible. Narrow/touch/reduced-motion: no loop, no arrows, no
// duplicates — a native horizontal scroller with snap points instead.

const MIN_SET = 8;
/** Seconds for the strip to travel one card's width at cruising speed. */
const SECONDS_PER_CARD = 6;
const FAST_FORWARD = 4;
/** Velocity easing time constant (ms) — how quickly it settles on a new target speed. */
const EASE_MS = 220;
const NARROW_QUERY = "(max-width: 860px), (pointer: coarse)";

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useIsNarrow() {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW_QUERY).matches, () => false);
}

function PanelCarousel({ panels, tenantCode }: { panels: LandingPanel[]; tenantCode: TenantCode }) {
  const { t } = useTranslation("landing");
  const reducedMotion = usePrefersReducedMotion();
  const isNarrow = useIsNarrow();
  const animated = !isNarrow && !reducedMotion;
  const [category, setCategory] = useState<PanelCategory | "all">("all");

  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const dirRef = useRef(0);

  const list = orderForCategory(panels, category);
  // Texture by position in the list (not per panel), so neighbours never share a texture
  // whichever category is showing.
  const withTexture = list.map((panel, i) => ({ panel, texture: PANEL_TEXTURES[i % PANEL_TEXTURES.length]! }));
  // Repeat the set until it's at least MIN_SET long (so one set is always wider than the
  // viewport), then double it — the second copy is what scrolls into view as the first leaves.
  const reps = Math.max(1, Math.ceil(MIN_SET / list.length));
  const set = Array.from({ length: reps }, (_, rep) => withTexture.map((p) => ({ ...p, dup: rep > 0 }))).flat();
  const items = animated ? [...set, ...set.map((p) => ({ ...p, dup: true }))] : withTexture.map((p) => ({ ...p, dup: false }));

  // Restarts from the first card whenever the category changes (the old offset belongs to a
  // different set width).
  useEffect(() => {
    const track = trackRef.current;
    if (!animated || !track) {
      if (track) track.style.transform = "";
      track?.parentElement?.scrollTo({ left: 0 });
      return;
    }
    let offset = 0;
    let velocity = 1;
    let last = performance.now();
    let raf = requestAnimationFrame(function loop(now) {
      const dt = Math.min(64, now - last);
      last = now;
      const cards = track.children;
      const half = cards.length / 2;
      const first = cards[0] as HTMLElement | undefined;
      const mid = cards[half] as HTMLElement | undefined;
      // Measured every frame, not once: a hovered card widens, which changes the set's width.
      const setWidth = first && mid ? mid.getBoundingClientRect().left - first.getBoundingClientRect().left : 0;
      if (setWidth > 0) {
        const target = dirRef.current || (pausedRef.current ? 0 : 1);
        velocity += (target - velocity) * Math.min(1, dt / EASE_MS);
        const pitch = setWidth / half;
        offset += (velocity * dt * pitch) / (SECONDS_PER_CARD * 1000);
        offset = ((offset % setWidth) + setWidth) % setWidth;
        track.style.transform = `translate3d(${-offset}px,0,0)`;
      }
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [animated, category]);

  const arrowClass =
    "absolute top-1/2 z-10 hidden h-40 w-16 -translate-y-1/2 items-center justify-center border-0 bg-transparent text-[30px] font-extralight leading-none text-white transition-opacity duration-200 hover:opacity-60 cursor-pointer";

  return (
    <>
    <div className="mx-auto mb-9 flex flex-wrap justify-center gap-2" role="group" aria-label={t("terminal.categories.all")}>
      {(["all", ...PANEL_CATEGORIES] as const).map((c) => {
        const active = c === category;
        const count = c === "all" ? panels.length : panels.filter((p) => p.category === c).length;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={active}
            onClick={() => setCategory(c)}
            className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
              active ? "border-white bg-white text-[#0b0b0b]" : "border-white/12 bg-white/5 text-white hover:border-white/30"
            }`}
          >
            <span>{t(`terminal.categories.${c}`)}</span>
            <span className="font-medium opacity-55">{count}</span>
          </button>
        );
      })}
    </div>
    <div className="relative">
      {animated && (
        <>
          <button
            type="button"
            aria-label="Rewind"
            tabIndex={-1}
            className={`${arrowClass} -left-2 lg:flex`}
            onMouseEnter={() => (dirRef.current = -FAST_FORWARD)}
            onMouseLeave={() => (dirRef.current = 0)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Fast-forward"
            tabIndex={-1}
            className={`${arrowClass} -right-2 lg:flex`}
            onMouseEnter={() => (dirRef.current = FAST_FORWARD)}
            onMouseLeave={() => (dirRef.current = 0)}
          >
            ›
          </button>
        </>
      )}
      <div
        className={
          animated
            ? "relative -mx-6 md:-mx-16 overflow-hidden mask-[linear-gradient(90deg,transparent_0,#000_6%,#000_94%,transparent_100%)]"
            : "relative -mx-6 md:-mx-16 overflow-x-auto snap-x snap-mandatory scrollbar-none"
        }
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
        // Keyboard users tabbing through the cards: hold the strip still so focus can't drift off-screen.
        onFocus={() => (pausedRef.current = true)}
        onBlur={() => (pausedRef.current = false)}
      >
        <div
          ref={trackRef}
          className={`flex w-max will-change-transform ${animated ? "gap-4 px-6 md:px-16" : "gap-3 px-[10vw]"}`}
        >
          {items.map(({ panel, texture, dup }, i) => (
            <PanelCard key={`${panel.id}-${i}`} panel={panel} texture={texture} duplicate={dup} animated={animated} tenantCode={tenantCode} />
          ))}
        </div>
      </div>
    </div>
    </>
  );
}

function PanelCard({
  panel,
  texture,
  duplicate,
  animated,
  tenantCode,
}: {
  panel: LandingPanel;
  texture: string;
  /** A repeat of an earlier card — hidden from assistive tech and the tab order. */
  duplicate: boolean;
  animated: boolean;
  tenantCode: TenantCode;
}) {
  const { t } = useTranslation("landing");
  return (
    <Link
      href="/signup"
      aria-hidden={duplicate || undefined}
      tabIndex={duplicate ? -1 : undefined}
      title={t(`terminal.cards.${panel.id}`)}
      className={`group relative flex-none min-h-130 overflow-hidden rounded-3xl bg-cover bg-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b] ${
        animated
          ? "w-80 transition-[width] duration-420 ease-landing hover:w-140"
          : "w-[80vw] max-w-[360px] snap-center"
      }`}
      style={{ backgroundImage: `url('${texture}')` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70 px-5 py-7">
        <span className="mb-2.5 inline-block rounded-full border border-white/25 bg-black/35 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
          {t(`terminal.categories.${panel.category}`)}
        </span>
        <h3 className="font-display text-white text-[22px] whitespace-nowrap [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
          {PANEL_TITLES[panel.id]}
        </h3>
        {/* Two lines max — a third runs under the mini window; the full line is the card's title tooltip. */}
        <p className="mt-2 max-w-[260px] line-clamp-2 text-white/85 text-[13px] leading-[1.5] [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
          {t(`terminal.cards.${panel.id}`)}
        </p>
      </div>
      <TerminalMockWindow panel={panel} tenantCode={tenantCode} />
    </Link>
  );
}
