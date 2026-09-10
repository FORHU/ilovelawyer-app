// apps/web/components/global-header.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, FileText, LogOut, Menu, UserCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogoutMutation } from "@/lib/auth/mutations";
import { useAuthStore } from "@/lib/store/auth.store";
import { useMobileNavStore } from "@/lib/store/mobile-nav.store";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface GlobalHeaderProps {
  // Enforces passing one of your exact six workspace pages
  activeTab:
    | "consultation"
    | "create-case"
    | "library"
    | "case-portfolio"
    | "terminal"
    | "transcription"
    | "document-analysis"
    | "calendar"
    | "term"
    | "profile"
    | "organization"
    // Secondary destinations — not part of the primary nav
    | "constitution"
    | "civil-code"
    | "scra-archive"
    | "revised-penal-code"
    | "labor-code"
    | "family-code"
    | "persuasive-rulings"
    | "presidential-issuances"
    | "administrative-issuances"
    | "judicial-issuances";
  /** When true, this header stops managing its own mobile masthead below lg: no bottom border,
   * and its hamburger trigger is hidden (the page renders its own, inline with page-specific
   * content, and opens the exact same drawer via useMobileNavStore) — used by the case detail
   * page, whose own title row takes over that role instead of stacking a second masthead row
   * underneath a redundant one. Desktop is completely unaffected either way. */
  mobileHeaderMerged?: boolean;
}

const USER_MENU_ITEMS = [
  { labelKey: "userMenu.profile", href: "/homepage/profile", icon: UserCircle, tooltip: "View and edit your profile" },
  { labelKey: "userMenu.organization", href: "/homepage/organization", icon: Building2, tooltip: "Manage your organization and team members" },
  { labelKey: "userMenu.terms", href: "/homepage/term", icon: FileText, tooltip: "Read the terms and conditions" },
] as const;

// Flat list for the mobile drawer, mirroring the flattened desktop nav — Cases now
// links straight to the portfolio (Create Case lives inside that page), and Legal
// Terminal is reached by drilling into a case rather than from top-level nav.
const MOBILE_NAV_ITEMS = [
  { tab: "consultation", labelKey: "nav.consultation", href: "/homepage", tooltip: "AI-powered legal consultation chat" },
  { tab: "case-portfolio", labelKey: "nav.casePortfolio", href: "/homepage/case-portfolio", tooltip: "View and manage your case portfolio" },
  { tab: "library", labelKey: "nav.library", href: "/homepage/library", tooltip: "Browse the legal research library" },
  { tab: "transcription", labelKey: "nav.transcription", href: "/homepage/transcription", tooltip: "Record and transcribe audio" },
  { tab: "document-analysis", labelKey: "nav.documents", href: "/homepage/document-analysis", tooltip: "Upload and analyze legal documents" },
  { tab: "calendar", labelKey: "nav.calendar", href: "/homepage/calendar", tooltip: "View and schedule appointments" },
] as const;

export default function GlobalHeader({ activeTab, mobileHeaderMerged = false }: GlobalHeaderProps) {
  const { t } = useTranslation("common");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  // Lifted into a store (not local state) so a page can render its own trigger — see
  // mobileHeaderMerged's doc comment above — that opens this exact same drawer.
  const isMobileMenuOpen = useMobileNavStore((s) => s.isOpen);
  const toggleMobileMenu = useMobileNavStore((s) => s.toggle);
  const closeMobileMenu = useMobileNavStore((s) => s.close);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isCaseTabActive = activeTab === "create-case" || activeTab === "case-portfolio";

  const user = useAuthStore((s) => s.user);
  const logout = useLogoutMutation();

  const initials = (user?.name ?? user?.username ?? "?")
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  // Close the dropdown on outside click, since it isn't a native <select>.
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  // Close the mobile drawer if the viewport grows past the lg breakpoint
  // (e.g. rotating a tablet, or resizing a browser window past 1024px).
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleResize = () => {
      if (window.innerWidth >= 1024) closeMobileMenu();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileMenuOpen, closeMobileMenu]);

  // Helper to dynamically toggle active states for the sub-tier workspace links.
  // Active items render bold + a small gold dot beneath the label (added inline where
  // this class is used) instead of just a brightness change, per the redesign. The dot is
  // absolutely positioned (not a flex-col sibling of the label) specifically so it never
  // affects this item's height/centering — a flex-col layout made the label itself shift
  // up whenever a dot appeared, so it no longer sat inline with the other labels.
  const getSubTabClass = (tabName: string) => {
    const baseClasses =
      "relative inline-flex items-center text-[10px] tracking-[1px] uppercase transition-all duration-200 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

    if (activeTab === tabName) {
      return `${baseClasses} text-white font-bold opacity-100`;
    }

    return `${baseClasses} opacity-60 text-white hover:opacity-100`;
  };

  const getMobileTabClass = (tabName: string) => {
    const baseClasses =
      "text-xs tracking-[1px] uppercase py-2.5 pl-3 border-l-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-inset";
    if (activeTab === tabName) {
      return `${baseClasses} text-white border-white font-bold`;
    }
    return `${baseClasses} text-white/60 border-transparent hover:text-white`;
  };

  return (
    <header
      className={`absolute top-0 left-0 w-full bg-brand-navy-950 z-50 ${
        mobileHeaderMerged ? "lg:border-b lg:border-white/10" : "border-b border-white/10"
      }`}
    >
      <div
        className={`w-full max-w-[1440px] mx-auto h-16 items-center justify-between gap-4 px-6 md:px-16 lg:justify-start lg:gap-8 ${
          mobileHeaderMerged ? "hidden lg:flex" : "flex"
        }`}
      >
        <Link
          href="/"
          className="shrink-0 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label={t("appName")}
        >
          <Logo forBackground="dark" size={40} />
        </Link>

        <nav className="hidden lg:flex flex-1 items-center justify-center gap-7 text-[10px] tracking-[1px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage" className={getSubTabClass("consultation")}>
                {t("nav.consultation").toUpperCase()}
                {activeTab === "consultation" && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>AI-powered legal consultation chat</TooltipContent>
          </Tooltip>

          {/* Flattened per the redesign — Create Case now lives inside the Cases page
              itself, and Legal Terminal is reached by drilling into a case rather than
              from a top-level nav item. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/case-portfolio" className={getSubTabClass("case-portfolio")}>
                {t("nav.cases", { defaultValue: "Cases" }).toUpperCase()}
                {isCaseTabActive && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>View and manage your case portfolio</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/library" className={getSubTabClass("library")}>
                {t("nav.library").toUpperCase()}
                {activeTab === "library" && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Browse the legal research library</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/transcription" className={getSubTabClass("transcription")}>
                {t("nav.transcription").toUpperCase()}
                {activeTab === "transcription" && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Record and transcribe audio</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/document-analysis" className={getSubTabClass("document-analysis")}>
                {t("nav.documents").toUpperCase()}
                {activeTab === "document-analysis" && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Upload and analyze legal documents</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/calendar" className={getSubTabClass("calendar")}>
                {t("nav.calendar").toUpperCase()}
                {activeTab === "calendar" && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>View and schedule appointments</TooltipContent>
          </Tooltip>
        </nav>

        {/* Icons are now inside the main flex row, styled white for visibility */}
        <div className="hidden lg:flex items-center gap-5 text-white">
          <LanguageSwitcher />

          <ThemeToggle />

          <div className="relative" ref={userMenuRef}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/40 text-[10px] font-semibold tracking-[0.5px] cursor-pointer transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${isUserMenuOpen ? "border-white" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-label={t("userMenu.accountMenu")}
                >
                  {initials}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("userMenu.accountMenu")}</TooltipContent>
            </Tooltip>

            {isUserMenuOpen && (
              <div
                role="menu"
                className="absolute top-full right-0 mt-3 w-52 bg-card border border-border rounded-xl shadow-xl py-1 overflow-hidden"
              >
                {user && (
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="truncate text-xs font-bold text-foreground">{user.name ?? user.username}</p>
                    {user.name && <p className="truncate text-[10px] text-muted-foreground">@{user.username}</p>}
                    <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
                  </div>
                )}

                {USER_MENU_ITEMS.map((item) => (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        role="menuitem"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-[10px] tracking-[1px] uppercase text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                      >
                        <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
                        {t(item.labelKey)}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="left">{item.tooltip}</TooltipContent>
                  </Tooltip>
                ))}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={logout.isPending}
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout.mutate();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 border-t border-border px-4 py-2.5 text-[10px] tracking-[1px] uppercase text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                      {logout.isPending ? t("userMenu.loggingOut") : t("userMenu.logout")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Sign out of your account</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger — replaces the inline nav + account icon below lg. Hidden when a
         * page owns its own trigger instead (mobileHeaderMerged) — see that prop's comment. */}
        {!mobileHeaderMerged && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="lg:hidden p-2 -mr-2 cursor-pointer bg-transparent border-0 text-white rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label={isMobileMenuOpen ? t("mobileMenu.close") : t("mobileMenu.open")}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{isMobileMenuOpen ? t("mobileMenu.close") : t("mobileMenu.open")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Mobile drawer — a narrow panel sliding in from the right (not a full-width dropdown),
       * same proportions as the Case Workspace's Topics/Studio drawers: ~80% width capped at
       * 300px, with a tap-to-close dimmed backdrop behind it. */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label={t("mobileMenu.close")}
            onClick={closeMobileMenu}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 right-0 w-[80%] max-w-[300px] overflow-y-auto border-l border-white/10 bg-brand-navy-950 px-4 py-4 shadow-2xl">
            <nav className="flex flex-col gap-0.5">
              {MOBILE_NAV_ITEMS.map((item) => (
                <Tooltip key={item.tab}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      onClick={closeMobileMenu}
                      className={getMobileTabClass(item.tab)}
                    >
                      {t(item.labelKey)}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="left">{item.tooltip}</TooltipContent>
                </Tooltip>
              ))}
            </nav>

            <div className="mt-4 flex flex-col gap-0.5 border-t border-white/10 pt-4">
              <div className="px-3 pb-3">
                <LanguageSwitcher />
              </div>

              {user && (
                <div className="flex items-center justify-between gap-2 px-3 pb-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{user.name ?? user.username}</p>
                    {user.name && <p className="truncate text-[10px] text-white/50">@{user.username}</p>}
                    <p className="truncate text-[10px] text-white/50">{user.email}</p>
                  </div>
                  <ThemeToggle />
                </div>
              )}

              {USER_MENU_ITEMS.map((item) => (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      onClick={closeMobileMenu}
                      className="flex items-center gap-2 py-2.5 pl-3 text-xs uppercase tracking-[1px] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
                    >
                      <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {t(item.labelKey)}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="left">{item.tooltip}</TooltipContent>
                </Tooltip>
              ))}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={logout.isPending}
                    onClick={() => {
                      closeMobileMenu();
                      logout.mutate();
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 py-2.5 pl-3 text-xs uppercase tracking-[1px] text-red-400 transition-colors hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    {logout.isPending ? t("userMenu.loggingOut") : t("userMenu.logout")}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Sign out of your account</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
