// apps/web/components/global-header.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, FileText, LogOut, Menu, User, UserCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogoutMutation } from "@/lib/auth/mutations";
import { useAuthStore } from "@/lib/store/auth.store";
import { LanguageSwitcher } from "@/components/language-switcher";
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
}

const CASE_MENU_ITEMS = [
  { tab: "create-case", labelKey: "nav.createCase", href: "/homepage/create-case", tooltip: "Start a new case filing" },
  { tab: "case-portfolio", labelKey: "nav.casePortfolio", href: "/homepage/case-portfolio", tooltip: "View and manage your case portfolio" },
] as const;

const USER_MENU_ITEMS = [
  { labelKey: "userMenu.profile", href: "/homepage/profile", icon: UserCircle, tooltip: "View and edit your profile" },
  { labelKey: "userMenu.organization", href: "/homepage/organization", icon: Building2, tooltip: "Manage your organization and team members" },
  { labelKey: "userMenu.terms", href: "/homepage/term", icon: FileText, tooltip: "Read the terms and conditions" },
] as const;

// Flat list for the mobile drawer — the desktop CASE dropdown's two items are
// inlined here directly since a nested toggle inside an already-open drawer
// is an extra tap for no benefit at phone width.
const MOBILE_NAV_ITEMS = [
  { tab: "consultation", labelKey: "nav.consultation", href: "/homepage", tooltip: "AI-powered legal consultation chat" },
  { tab: "create-case", labelKey: "nav.createCase", href: "/homepage/create-case", tooltip: "Start a new case filing" },
  { tab: "case-portfolio", labelKey: "nav.casePortfolio", href: "/homepage/case-portfolio", tooltip: "View and manage your case portfolio" },
  { tab: "terminal", labelKey: "nav.legalTerminal", href: "/homepage/terminal", tooltip: "Open a case in the Legal Terminal" },
  { tab: "library", labelKey: "nav.library", href: "/homepage/library", tooltip: "Browse the legal research library" },
  { tab: "transcription", labelKey: "nav.transcription", href: "/homepage/transcription", tooltip: "Record and transcribe audio" },
  { tab: "document-analysis", labelKey: "nav.documents", href: "/homepage/document-analysis", tooltip: "Upload and analyze legal documents" },
  { tab: "calendar", labelKey: "nav.calendar", href: "/homepage/calendar", tooltip: "View and schedule appointments" },
] as const;

export default function GlobalHeader({ activeTab }: GlobalHeaderProps) {
  const { t } = useTranslation("common");
  const [isCaseMenuOpen, setIsCaseMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const caseMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isCaseTabActive = activeTab === "create-case" || activeTab === "case-portfolio";

  const user = useAuthStore((s) => s.user);
  const logout = useLogoutMutation();

  // Close the dropdowns on outside click, since they aren't native <select>s.
  useEffect(() => {
    if (!isCaseMenuOpen && !isUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (caseMenuRef.current && !caseMenuRef.current.contains(e.target as Node)) {
        setIsCaseMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCaseMenuOpen, isUserMenuOpen]);

  // Close the mobile drawer if the viewport grows past the lg breakpoint
  // (e.g. rotating a tablet, or resizing a browser window past 1024px).
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileMenuOpen]);

  // Helper to dynamically toggle active states for the sub-tier workspace links
  const getSubTabClass = (tabName: string) => {
    const baseClasses =
      "text-[10px] tracking-[1px] uppercase transition-all duration-200 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

    if (activeTab === tabName) {
      // Active Look: Full opacity, bold text
      return `${baseClasses} text-white font-bold opacity-100`;
    }

    // Inactive Look: Dimmed opacity, brightens to white on hover
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
    <header className="absolute top-0 left-0 w-full bg-brand-navy-950 border-b border-white/10 z-50">
      <div className="w-full max-w-[1440px] mx-auto h-14 flex items-center justify-between gap-4 px-6 md:px-16 lg:justify-start lg:gap-8">
        <Link
          href="/"
          className="font-['Libre_Caslon_Text'] text-white text-[20px] tracking-[-0.6px] shrink-0 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {t("appName")}
        </Link>

        <nav className="hidden lg:flex flex-1 items-center justify-center gap-7 text-[10px] tracking-[1px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage" className={getSubTabClass("consultation")}>{t("nav.consultation").toUpperCase()}</Link>
            </TooltipTrigger>
            <TooltipContent>AI-powered legal consultation chat</TooltipContent>
          </Tooltip>

          <div className="relative" ref={caseMenuRef}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsCaseMenuOpen((prev) => !prev)}
                  className={`flex items-center gap-1 cursor-pointer rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    isCaseTabActive
                      ? "text-[10px] tracking-[1px] uppercase transition-all duration-200 text-white font-bold opacity-100"
                      : "text-[10px] tracking-[1px] uppercase transition-all duration-200 opacity-60 text-white hover:opacity-100"
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={isCaseMenuOpen}
                >
                  {t("nav.case").toUpperCase()}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${isCaseMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>Create or manage your cases</TooltipContent>
            </Tooltip>

            {isCaseMenuOpen && (
              <div
                role="menu"
                className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-44 bg-card border border-border rounded-xl shadow-xl py-1 overflow-hidden"
              >
                {CASE_MENU_ITEMS.map((item) => (
                  <Tooltip key={item.tab}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        role="menuitem"
                        onClick={() => setIsCaseMenuOpen(false)}
                        className={`block px-4 py-2.5 text-[10px] tracking-[1px] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 ${
                          activeTab === item.tab ? "text-foreground font-bold bg-foreground/5" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                        }`}
                      >
                        {t(item.labelKey)}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.tooltip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/terminal" className={getSubTabClass("terminal")}>{t("nav.legalTerminal").toUpperCase()}</Link>
            </TooltipTrigger>
            <TooltipContent>Open a case in the Legal Terminal</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/library" className={getSubTabClass("library")}>{t("nav.library").toUpperCase()}</Link>
            </TooltipTrigger>
            <TooltipContent>Browse the legal research library</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/transcription" className={getSubTabClass("transcription")}>{t("nav.transcription").toUpperCase()}</Link>
            </TooltipTrigger>
            <TooltipContent>Record and transcribe audio</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/document-analysis" className={getSubTabClass("document-analysis")}>{t("nav.documents").toUpperCase()}</Link>
            </TooltipTrigger>
            <TooltipContent>Upload and analyze legal documents</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/calendar" className={getSubTabClass("calendar")}>{t("nav.calendar").toUpperCase()}</Link>
            </TooltipTrigger>
            <TooltipContent>View and schedule appointments</TooltipContent>
          </Tooltip>
        </nav>

        {/* Icons are now inside the main flex row, styled white for visibility */}
        <div className="hidden lg:flex items-center items-center gap-[24px] text-white">
          <LanguageSwitcher />

          <ThemeToggle />

          <div className="relative" ref={userMenuRef}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className={`cursor-pointer rounded-full p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${isUserMenuOpen ? "opacity-100" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-label={t("userMenu.accountMenu")}
                >
                  <User className="w-5 h-5" />
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

        {/* Mobile hamburger — replaces the inline nav + account icon below lg */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 -mr-2 cursor-pointer bg-transparent border-0 text-white rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label={isMobileMenuOpen ? t("mobileMenu.close") : t("mobileMenu.open")}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{isMobileMenuOpen ? t("mobileMenu.close") : t("mobileMenu.open")}</TooltipContent>
        </Tooltip>
      </div>

      {/* Mobile drawer — full-width panel replacing the desktop nav + account menu below lg */}
      {isMobileMenuOpen && (
        <div className="lg:hidden max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t border-white/10 bg-brand-navy-950 px-4 py-4">
          <nav className="flex flex-col gap-0.5">
            {MOBILE_NAV_ITEMS.map((item) => (
              <Tooltip key={item.tab}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={getMobileTabClass(item.tab)}
                  >
                    {t(item.labelKey)}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.tooltip}</TooltipContent>
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
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-2.5 pl-3 text-xs uppercase tracking-[1px] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
                  >
                    <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {t(item.labelKey)}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.tooltip}</TooltipContent>
              </Tooltip>
            ))}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={logout.isPending}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout.mutate();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 py-2.5 pl-3 text-xs uppercase tracking-[1px] text-red-400 transition-colors hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  {logout.isPending ? t("userMenu.loggingOut") : t("userMenu.logout")}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out of your account</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </header>
  );
}
