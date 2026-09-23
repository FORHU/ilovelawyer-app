"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/lib/store/auth.store";
import { ThemeToggle } from "@/components/theme-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { smoothScrollToHash } from "@/lib/landing/smooth-scroll-to";

const NAV_LINKS = [
  { key: "capabilities", href: "#capabilities", tooltip: "See every feature the platform ships" },
  { key: "legalTerminal", href: "#control", tooltip: "Preview the Legal Terminal workspace" },
  { key: "firms", href: "#business", tooltip: "How firms and teams work in ilovelawyer" },
  // The footer is `position: fixed` (see footer-reveal-portal.tsx) — #footer-spacer is the
  // actual scroll target, not the footer element itself.
  { key: "resources", href: "#footer-spacer", tooltip: "Help centre, support and legal resources" },
] as const;

// Transparent-over-hero at rest, frosted on hover of the header itself (handoff §1) — one
// `group` on <header> drives every child's color/border/text-shadow flip in the same 300ms.
// Pages with no hero underneath (`overHero={false}`, e.g. the neutral jurisdiction splash)
// get the frosted look permanently instead, since white-on-transparent has nothing dark
// behind it to stay legible against.
const OVER_HERO_INK = "text-white group-hover:text-[#1a1a1a] [text-shadow:0_1px_4px_rgba(0,0,0,0.5)] group-hover:[text-shadow:none]";
const OVER_HERO_BORDER = "border-white/75 group-hover:border-[#1a1a1a]/20";
const SOLID_INK = "text-[#1a1a1a]";
const SOLID_BORDER = "border-[#1a1a1a]/20";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]";

export function LandingNavbar({ overHero = true }: { overHero?: boolean }) {
  const { t } = useTranslation("landing");
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  const LINK_INK = `transition-colors duration-300 ${overHero ? OVER_HERO_INK : SOLID_INK}`;
  const BORDER_INK = `transition-colors duration-300 ${overHero ? OVER_HERO_BORDER : SOLID_BORDER}`;

  return (
    <header
      className={`group fixed top-0 inset-x-0 z-(--z-header-drawer) w-full flex flex-wrap items-center justify-between gap-3 px-8 py-3.5 backdrop-blur-0 border-b transition-[background-color,backdrop-filter,border-color] duration-300 ${
        overHero
          ? "bg-transparent border-transparent hover:bg-white/92 hover:backdrop-blur-lg hover:border-b-[#1a1a1a]/8"
          : "bg-white/92 backdrop-blur-lg border-b-[#1a1a1a]/8"
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

      <Link
        href="/"
        className={`shrink-0 font-display text-[19px] tracking-[-0.02em] lowercase rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/60 ${LINK_INK}`}
        aria-label="ilovelawyer"
      >
        ilovelawyer
      </Link>

      <div className={`hidden lg:flex flex-1 items-center justify-end gap-4 shrink-0 ${LINK_INK}`}>
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className={`flex items-center gap-2 flex-1 max-w-[220px] rounded-[45px] border px-[15px] py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-current/60 ${BORDER_INK}`}
        >
          <Search size={12} className="shrink-0 opacity-70" aria-hidden />
          <label className="sr-only" htmlFor="landing-nav-search">
            {t("navbar.searchLabel")}
          </label>
          <input
            id="landing-nav-search"
            type="search"
            placeholder={t("navbar.searchPlaceholder")}
            className="w-full bg-transparent border-0 outline-none text-sm placeholder:text-current placeholder:opacity-70"
          />
        </form>
        <ThemeToggle />
        {isAuthenticated ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage"
                className={`bg-brand-gold text-brand-navy-950 text-xs tracking-[1.2px] uppercase font-semibold px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors duration-200 ${FOCUS_RING}`}
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
                  className={`text-xs tracking-[1.2px] uppercase font-semibold border rounded-full px-5 py-2.5 hover:opacity-62 transition-opacity duration-200 ${BORDER_INK} ${FOCUS_RING}`}
                >
                  {t("navbar.requestDemo")}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Create an account to request a live demo</TooltipContent>
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
                className={`flex-1 bg-brand-gold text-brand-navy-950 text-xs font-semibold px-4 py-3 text-center rounded-full hover:bg-brand-gold/85 transition-colors duration-200 ${FOCUS_RING}`}
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
                  className={`flex-1 bg-brand-gold text-brand-navy-950 text-xs font-semibold px-4 py-3 text-center rounded-full hover:bg-brand-gold/85 transition-colors duration-200 ${FOCUS_RING}`}
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
