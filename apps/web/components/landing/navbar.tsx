"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/lib/store/auth.store";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { FOOTER_HASH, smoothScrollToHash } from "@/lib/landing/smooth-scroll-to";
import { hasSessionHint } from "@/lib/fetch";

const NAV_LINKS = [
  { key: "capabilities", href: "#capabilities", tooltip: "See every feature the platform ships" },
  { key: "legalTerminal", href: "#control", tooltip: "Preview the Legal Terminal workspace" },
  { key: "firms", href: "#business", tooltip: "How firms and teams work in ilovelawyer" },
  // The footer is `position: fixed` (see footer-reveal-portal.tsx) — "#footer" scrolls to the
  // page's end, where the footer is fully revealed (see smoothScrollToHash).
  { key: "resources", href: FOOTER_HASH, tooltip: "Help centre, support and legal resources" },
] as const;

// Fully transparent over the hero while at the top, frosted once scrolled. Hover deliberately
// does not frost it — scrolling back up with the cursor resting on the header left it frosted
// at the top. Pages with no hero underneath (`overHero={false}`, e.g. the neutral jurisdiction
// splash) get the frosted look permanently instead, since white-on-transparent has nothing
// dark behind it to stay legible against.
const OVER_HERO_INK = "text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]";
const OVER_HERO_BORDER = "border-white/75";
const SOLID_INK = "text-[#1a1a1a]";
const SOLID_BORDER = "border-[#1a1a1a]/20";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]";

export function LandingNavbar({ overHero = true }: { overHero?: boolean }) {
  const { t } = useTranslation("landing");
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasAccessToken = useAuthStore((s) => !!s.accessToken);
  // The public page never runs a silent refresh, so a signed-in visitor arriving fresh has no
  // access token here. The hasSession cookie says a session exists without spending the
  // single-use refresh token; /homepage redeems it. Read after mount so SSR and the first
  // client render agree.
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => setHasSession(hasSessionHint()), []);
  const isAuthenticated = hasAccessToken || hasSession;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Capture-phase on document (not a bubbling window listener) — html is the scroller here
    // (`overflow-y: auto`, globals.css). Only native positions are read: ScrollSmoother's
    // `scrollTop()` trails the native scroll by its `smooth` duration, so on the last scroll
    // event at the top it still reads > 0 and (under Math.max) pinned the header frosted.
    const onScroll = () => {
      const y = Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop);
      setScrolled(y > 0);
    };
    onScroll();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  // Once the page is scrolled the hero is no longer guaranteed to sit behind the header, so it
  // switches to the frosted look.
  const transparent = overHero && !scrolled;
  const LINK_INK = `transition-colors duration-300 ${transparent ? OVER_HERO_INK : SOLID_INK}`;
  const BORDER_INK = `transition-colors duration-300 ${transparent ? OVER_HERO_BORDER : SOLID_BORDER}`;

  // `bg-clip-padding` keeps the frosted white fill out from under the bottom border — otherwise
  // the translucent white border sits on white and never shows against the page below.
  return (
    <header
      className={`fixed top-0 inset-x-0 z-(--z-header-drawer) w-full flex flex-wrap items-center justify-between gap-3 px-8 py-3.5 backdrop-blur-0 border-b bg-clip-padding transition-[background-color,backdrop-filter,border-color] duration-300 ${
        transparent
          ? "bg-transparent border-transparent"
          : "bg-white/75 backdrop-blur-lg border-b-white/25"
      }`}
    >
      <nav className={`hidden lg:flex flex-1 items-center gap-1 text-[15px] tracking-[-0.018em] ${LINK_INK}`}>
        {NAV_LINKS.map((link) => (
          <Tooltip key={link.key}>
            <TooltipTrigger asChild>
              <a
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  smoothScrollToHash(link.href);
                }}
                className="px-2 py-1 opacity-100 hover:opacity-62 transition-opacity duration-200 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/60"
              >
                {t(`navbar.links.${link.key}`)}
              </a>
            </TooltipTrigger>
            <TooltipContent>{link.tooltip}</TooltipContent>
          </Tooltip>
        ))}
      </nav>

      {/* `forBackground="current"` (not the dashboard header's `"auto"`) — this logo needs to
          transition with `LINK_INK` (transparent-over-hero white → solid-ink-on-hover), which a
          fixed `dark`/`light` pair can't do; `currentColor` inherits that transition directly. */}
      <Link
        href="/"
        className={`shrink-0 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/60 ${LINK_INK}`}
        aria-label="ilovelawyer"
      >
        <Logo forBackground="current" size={40} />
      </Link>

      {/* flex-1 (not shrink-to-content) even though this side is lighter now the search box is
          gone — it balances against the left nav's own flex-1 so the logo in between stays
          centered rather than drifting toward whichever side is narrower. */}
      <div className={`hidden lg:flex flex-1 items-center justify-end gap-4 shrink-0 ${LINK_INK}`}>
        <ThemeToggle />
        {isAuthenticated ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage"
                className={`bg-brand-gold text-brand-gold-foreground text-xs tracking-[1.2px] uppercase font-semibold px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors duration-200 ${FOCUS_RING}`}
              >
                {t("navbar.goToDashboard")}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Return to your homepage dashboard</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/login"
                  className={`text-xs tracking-[1.2px] uppercase border rounded-full px-5 py-2.5 hover:opacity-62 transition-opacity duration-200 ${BORDER_INK} ${FOCUS_RING}`}
                >
                  {t("navbar.signIn")}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Log in to your existing account</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/signup"
                  className={`text-xs tracking-[1.2px] uppercase font-semibold rounded-full px-5 py-2.5 bg-black text-white [text-shadow:none] hover:opacity-62 transition-opacity duration-200 ${FOCUS_RING}`}
                >
                  {t("navbar.getStarted")}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Create your free ilovelawyer account</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`lg:hidden p-2 -mr-2 cursor-pointer bg-transparent border-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/60 ${LINK_INK}`}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? t("navbar.closeMenu") : t("navbar.openMenu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{mobileOpen ? t("navbar.closeMenu") : t("navbar.openMenu")}</TooltipContent>
      </Tooltip>

      {mobileOpen && (
        <div className="lg:hidden w-full border-t border-white/10 bg-brand-navy-950 px-6 py-6 flex flex-col gap-5">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.key}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  smoothScrollToHash(link.href);
                }}
                className={`text-xs tracking-[1px] uppercase text-white/70 hover:text-white transition-colors duration-200 rounded-xs ${FOCUS_RING}`}
              >
                {t(`navbar.links.${link.key}`)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-white">
            <ThemeToggle />
          </div>
          <div className="flex gap-3">
            {isAuthenticated ? (
              <Link
                href="/homepage"
                onClick={() => setMobileOpen(false)}
                className={`flex-1 bg-brand-gold text-brand-gold-foreground text-xs font-semibold px-4 py-3 text-center rounded-full hover:bg-brand-gold/85 transition-colors duration-200 ${FOCUS_RING}`}
              >
                {t("navbar.goToDashboard")}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className={`flex-1 border border-white/40 text-white text-xs px-4 py-3 text-center rounded-full hover:border-white transition-colors duration-200 ${FOCUS_RING}`}
                >
                  {t("navbar.signIn")}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className={`flex-1 bg-brand-gold text-brand-gold-foreground text-xs font-semibold px-4 py-3 text-center rounded-full hover:bg-brand-gold/85 transition-colors duration-200 ${FOCUS_RING}`}
                >
                  {t("navbar.getStarted")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
