"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { useAuthStore } from "@/lib/store/auth.store";
import { ThemeToggle } from "@/components/theme-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

const NAV_LINKS = [
  { key: "capabilities", href: "#capabilities", tooltip: "See every feature the platform ships" },
  { key: "legalTerminal", href: "#control", tooltip: "Preview the Legal Terminal workspace" },
  { key: "firms", href: "#business", tooltip: "How firms and teams work in ilovelawyer" },
  { key: "resources", href: "#footer", tooltip: "Help centre, support and legal resources" },
] as const;

export function LandingNavbar() {
  const { t } = useTranslation("landing");
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  return (
    <header className="sticky top-0 z-50 w-full bg-brand-navy-950 border-b border-white/10">
      <div className="max-w-360 mx-auto flex items-center justify-between gap-6 px-6 md:px-16 h-16">
        <Link
          href="/"
          className="shrink-0 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label="ilovelawyer"
        >
          <Logo forBackground="dark" size={40} />
        </Link>

        <nav className="hidden lg:flex flex-1 items-center justify-center gap-7 text-[10px] tracking-[1px]">
          {NAV_LINKS.map((link) => (
            <Tooltip key={link.key}>
              <TooltipTrigger asChild>
                <a
                  href={link.href}
                  className="uppercase text-white opacity-60 hover:opacity-100 transition-opacity duration-200 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  {t(`navbar.links.${link.key}`)}
                </a>
              </TooltipTrigger>
              <TooltipContent>{link.tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-5 text-white shrink-0">
          <LanguageSwitcher />
          <ThemeToggle />
          {isAuthenticated ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/homepage"
                  className="bg-brand-gold text-brand-navy-950 text-xs tracking-[1.2px] uppercase font-semibold px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors duration-200"
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
                    className="text-xs tracking-[1.2px] uppercase border border-white/40 rounded-full px-5 py-2.5 hover:border-white transition-colors duration-200"
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
                    className="bg-brand-gold text-brand-navy-950 text-xs tracking-[1.2px] uppercase font-semibold px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors duration-200"
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
              className="lg:hidden p-2 -mr-2 cursor-pointer bg-transparent border-0 text-white rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? t("navbar.closeMenu") : t("navbar.openMenu")}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{mobileOpen ? t("navbar.closeMenu") : t("navbar.openMenu")}</TooltipContent>
        </Tooltip>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-brand-navy-950 px-6 py-6 flex flex-col gap-5">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.key}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-xs tracking-[1px] uppercase text-white/70 hover:text-white transition-colors duration-200"
              >
                {t(`navbar.links.${link.key}`)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-white">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <div className="flex gap-3">
            {isAuthenticated ? (
              <Link
                href="/homepage"
                onClick={() => setMobileOpen(false)}
                className="flex-1 bg-brand-gold text-brand-navy-950 text-xs font-semibold px-4 py-3 text-center rounded-full hover:bg-brand-gold/85 transition-colors duration-200"
              >
                {t("navbar.goToDashboard")}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 border border-white/40 text-white text-xs px-4 py-3 text-center rounded-full hover:border-white transition-colors duration-200"
                >
                  {t("navbar.signIn")}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 bg-brand-gold text-brand-navy-950 text-xs font-semibold px-4 py-3 text-center rounded-full hover:bg-brand-gold/85 transition-colors duration-200"
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
