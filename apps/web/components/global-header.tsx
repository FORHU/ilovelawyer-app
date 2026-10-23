// apps/web/components/global-header.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Briefcase, Building2, CalendarDays, FileText, Inbox, LogOut, Menu, MessageCircle, MessageSquareText, Sparkles, UserCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogoutMutation } from "@/lib/auth/mutations";
import { useTrial } from "@/lib/trial";
import { useOpenClientRequestCount } from "@/lib/client-requests/queries";
import { useAuthStore } from "@/lib/store/auth.store";
import { isFeatureEnabled } from "@/config/tenant-codes/capabilities";
import { useClientRequestInboxCountQuery } from "@/lib/client-requests/inbox";
import { UserAvatar } from "@/components/user-avatar";
import { useFreeCredit } from "@/lib/free-credit";
import { useAccountAiAllowanceQuery } from "@/lib/account/ai-allowance";
import { useMobileNavStore } from "@/lib/store/mobile-nav.store";
import { useTourStore } from "@/lib/store/tour.store";
import { useFeedbackStore } from "@/lib/store/feedback.store";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { MobileDrawer } from "@/components/mobile-drawer";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { PortfolioPill } from "@/components/portfolio-pill";
import { SharedWorkspacePill } from "@/components/shared-workspace";
import { NotificationBellTrigger } from "@/components/notifications/notification-bell-trigger";
import { useNotificationBellState } from "@/components/notifications/use-notification-bell-state";
import { ThemeToggle } from "@/components/theme-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export const ACTIVE_TABS = [
  "consultation",
  "create-case",
  "library",
  "case-portfolio",
  "client-request",
  "terminal",
  "calendar",
  "term",
  "profile",
  "organization",
  "notifications",
  "client-requests",
  // Secondary destinations — not part of the primary nav
  "constitution",
  "civil-code",
  "scra-archive",
  "revised-penal-code",
  "labor-code",
  "family-code",
  "persuasive-rulings",
  "presidential-issuances",
  "administrative-issuances",
  "judicial-issuances",
] as const;

export type ActiveTab = (typeof ACTIVE_TABS)[number];

interface GlobalHeaderProps {
  /** Undefined highlights nothing (e.g. a redirect-only route). */
  activeTab?: ActiveTab;
}

// Renders inside a <Link>'s children — useLinkStatus only reports the pending
// state of its nearest ancestor Link, so this can't live at GlobalHeader's own
// level. Gives instant feedback on click rather than leaving the tab visually
// inert until the target route's JS + data finish loading, which is what
// invited spam-clicking on slow connections. Two simultaneous signals (a
// visible pill behind the tab, and the label itself dimming) rather than one
// subtle one — an 8%-opacity background tint alone turned out to be too
// faint to register as "something happened" in practice.
function TabLinkContent({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending && (
        <span aria-hidden="true" className="absolute -inset-x-2 -inset-y-1.5 rounded-full bg-foreground/15 animate-pulse" />
      )}
      <span className={`transition-opacity duration-150 ${pending ? "opacity-50" : ""}`}>{children}</span>
    </>
  );
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const USER_MENU_ITEMS = [
  { labelKey: "userMenu.profile", href: "/homepage/profile", icon: UserCircle, tooltip: "View and edit your profile" },
  { labelKey: "userMenu.organization", href: "/homepage/organization", icon: Building2, tooltip: "Manage your organization and team members" },
  { labelKey: "userMenu.terms", href: "/homepage/term", icon: FileText, tooltip: "Read the terms and conditions" },
] as const;

// Flat list for the mobile drawer, mirroring the flattened desktop nav — Cases now
// links straight to the portfolio (Create Case lives inside that page), and Legal
// Terminal is reached by drilling into a case rather than from top-level nav.
const MOBILE_NAV_ITEMS = [
  { tab: "consultation", labelKey: "nav.consultation", href: "/homepage", tooltip: "AI-powered legal consultation chat", icon: MessageCircle },
  { tab: "case-portfolio", labelKey: "nav.casePortfolio", href: "/homepage/case-portfolio", tooltip: "View and manage your case portfolio", icon: Briefcase, tourId: "nav-case-portfolio" },
  { tab: "client-request", labelKey: "nav.clientRequest", href: "/homepage/client-request", tooltip: "Review and manage client requests", icon: Inbox, tourId: "nav-client-request" },
  { tab: "library", labelKey: "nav.library", href: "/homepage/library", tooltip: "Browse the legal research library", icon: BookOpen, tourId: "nav-library" },
  { tab: "calendar", labelKey: "nav.calendar", href: "/homepage/calendar", tooltip: "View and schedule appointments", icon: CalendarDays, tourId: "nav-calendar" },
] as const;

// Gated separately (isFeatureEnabled check at render time) rather than folded into
// MOBILE_NAV_ITEMS above: UK-tenant only, see config/tenant-codes/uk.ts's "clientRequests".
const CLIENT_REQUESTS_NAV_ITEM = {
  tab: "client-requests",
  labelKey: "nav.clientRequests",
  href: "/homepage/client-requests",
  tooltip: "Client requests waiting for a lawyer to accept",
  icon: Inbox,
} as const;

export default function GlobalHeader({ activeTab }: GlobalHeaderProps) {
  const { t } = useTranslation("common");
  const openRequestCount = useOpenClientRequestCount();
  // A trial guest has no profile or organization of their own to manage: greyed out, not hidden,
  // so the shape of the product still shows. Terms stay open.
  const trial = useTrial();
  const trialLocked = (href: string) => !!trial && href !== "/homepage/term";
  const { t: tTour } = useTranslation("tour");
  const router = useRouter();
  const openGuide = useTourStore((s) => s.setGuideOpen);
  const setFeedbackOpen = useFeedbackStore((s) => s.setOpen);
  // Both are right-hand drawers, so opening one closes the other.
  const openFeedback = () => {
    openGuide(false);
    setFeedbackOpen(true);
  };
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  // Lifted into a store (not local state) so a page can render its own trigger — see
  // mobileHeaderMerged's comment below — that opens this exact same drawer.
  const isMobileMenuOpen = useMobileNavStore((s) => s.isOpen);
  const toggleMobileMenu = useMobileNavStore((s) => s.toggle);
  const closeMobileMenu = useMobileNavStore((s) => s.close);
  // When true, this header stops managing its own mobile masthead below lg: no bottom border,
  // and its hamburger trigger is hidden (the page renders its own, inline with page-specific
  // content, and opens the exact same drawer via useMobileNavStore) — set by the case detail
  // page through PageShell's mobileHeaderMerged, whose own title row takes over that role
  // instead of stacking a second masthead row underneath a redundant one. Desktop is
  // completely unaffected either way.
  const mobileHeaderMerged = useMobileNavStore((s) => s.headerMerged);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isCaseTabActive = activeTab === "create-case" || activeTab === "case-portfolio";
  // Mobile only: tapping the bell (moved up into the profile row) sends the user straight to
  // the full notifications page instead of expanding an inline list — the drawer is narrow
  // enough that an in-place list left barely any of it visible at once. The hook is still
  // used (with the list query left off, `open: false`) purely for the unread badge/reconnect
  // dot on the trigger button itself.
  const mobileNotificationState = useNotificationBellState(false, () => {});

  const user = useAuthStore((s) => s.user);
  const logout = useLogoutMutation();
  // An account on its free AI credit is a trial account until subscription tiers exist: the header
  // says so and shows what is left of the credit.
  const freeCredit = useFreeCredit();
  // Account-wide AI allowance (cases aren't billed individually) — shown so a lawyer can see a
  // top-up applied and isn't "being cheated"; { limited: false } for a non-LAWYER account.
  const { data: accountAllowance } = useAccountAiAllowanceQuery();

  const tenantCode = useAuthStore((s) => s.organization?.tenantCode);
  // A sample-case visitor is a trial guest with no clients: the inbox and its count are not theirs to see.
  const clientRequestsEnabled = isFeatureEnabled(tenantCode, "clientRequests") && !trial;
  const clientRequestsCount = useClientRequestInboxCountQuery(clientRequestsEnabled);
  const mobileNavItems = clientRequestsEnabled ? [...MOBILE_NAV_ITEMS, CLIENT_REQUESTS_NAV_ITEM] : MOBILE_NAV_ITEMS;

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
      "relative inline-flex items-center text-[10px] tracking-[1px] uppercase transition-all duration-200 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

    if (activeTab === tabName) {
      return `${baseClasses} text-foreground font-bold opacity-100`;
    }

    return `${baseClasses} opacity-60 text-foreground hover:opacity-100`;
  };

  const getMobileTabClass = (tabName: string) => {
    // Same uppercase-tracked "chrome" label style the desktop nav uses (see DESIGN.md — this
    // app doesn't have a second nav label style), just scaled up for a real touch target: a
    // full-width row instead of an inline label, bigger text, and a 48px-plus tap height.
    // rounded-r-lg, not rounded-lg: rounding all four corners on a row that also carries a
    // left accent border makes that border trace the rounded top/bottom-left corners into a
    // curved bracket instead of sitting as a flat bar — rounding only the trailing edge keeps
    // the left border a clean straight line.
    const baseClasses =
      "relative flex items-center gap-3 rounded-r-lg border-l-2 px-3 py-3.5 text-[13px] tracking-[1px] uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";
    if (activeTab === tabName) {
      return `${baseClasses} border-foreground bg-accent font-bold text-foreground`;
    }
    return `${baseClasses} border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground`;
  };

  return (
    <header
      // `fixed`, not `absolute`: this sits inside PageShell's normal-flow wrapper, and most
      // pages (anything without PageShell's own h-screen/overflow-hidden override, e.g.
      // Calendar) scroll the whole document rather than an inner panel — `absolute` scrolls
      // away with that document instead of staying pinned to the viewport.
      className={`fixed top-0 left-0 w-full bg-background z-(--z-modal) print:hidden ${
        mobileHeaderMerged ? "lg:border-b lg:border-border" : "border-b border-border"
      }`}
    >
      {/* Full-width, not capped to a max-w container, so the logo and the icon group sit at
       * the viewport's own edges. On lg+ it's a 1fr/auto/1fr grid rather than flex: the two
       * equal outer columns keep the nav at the true horizontal center of the screen, which a
       * flex-1 nav only manages when the logo and the icon group happen to be the same width. */}
      <div
        className={`w-full h-16 items-center justify-between gap-4 px-6 md:px-10 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-8 ${
          mobileHeaderMerged ? "hidden lg:grid" : "flex"
        }`}
      >
        <Link
          href="/"
          className="shrink-0 justify-self-start rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("appName")}
        >
          <Logo forBackground="auto" size={40} />
        </Link>

        <nav className="hidden lg:flex items-center justify-center gap-7 text-[10px] tracking-[1px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage" className={getSubTabClass("consultation")}>
                <TabLinkContent>{t("nav.consultation").toUpperCase()}</TabLinkContent>
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
              <Link href="/homepage/case-portfolio" data-tour-id="nav-case-portfolio" className={getSubTabClass("case-portfolio")}>
                <TabLinkContent>{t("nav.cases", { defaultValue: "Cases" }).toUpperCase()}</TabLinkContent>
                {isCaseTabActive && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>View and manage your case portfolio</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/client-request" data-tour-id="nav-client-request" className={getSubTabClass("client-request")}>
                <TabLinkContent>
                  {t("nav.clientRequest").toUpperCase()}
                  {openRequestCount > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-semibold text-background">
                      {openRequestCount}
                    </span>
                  )}
                </TabLinkContent>
                {activeTab === "client-request" && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Review and manage client requests</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/library" data-tour-id="nav-library" className={getSubTabClass("library")}>
                <TabLinkContent>{t("nav.library").toUpperCase()}</TabLinkContent>
                {activeTab === "library" && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Browse the legal research library</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/homepage/calendar" data-tour-id="nav-calendar" className={getSubTabClass("calendar")}>
                <TabLinkContent>{t("nav.calendar").toUpperCase()}</TabLinkContent>
                {activeTab === "calendar" && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
              </Link>
            </TooltipTrigger>
            <TooltipContent>View and schedule appointments</TooltipContent>
          </Tooltip>

          {clientRequestsEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/homepage/client-requests" className={getSubTabClass("client-requests")}>
                  <TabLinkContent>{t("nav.clientRequests").toUpperCase()}</TabLinkContent>
                  {clientRequestsCount > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold px-1 text-[9px] font-bold text-brand-gold-foreground">
                      {clientRequestsCount}
                    </span>
                  )}
                  {activeTab === "client-requests" && <span aria-hidden="true" className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Client requests waiting for a lawyer to accept</TooltipContent>
            </Tooltip>
          )}
        </nav>

        {/* Icons are now inside the main flex row */}
        <div className="hidden lg:flex justify-self-end items-center gap-5 text-foreground">
          <span data-tour-id="header-lang" className="inline-flex">
            <LanguageSwitcher />
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={openFeedback}
                data-tour-id="header-feedback"
                aria-label={t("feedback.open", { defaultValue: "Send feedback" })}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border pl-2.5 pr-3 text-[10px] uppercase tracking-[1px] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MessageSquareText className="size-3" aria-hidden="true" />
                {t("feedback.button", { defaultValue: "Feedback" })}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("feedback.open", { defaultValue: "Send feedback" })}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-tour-id="header-guide"
                onClick={() => openGuide(true)}
                aria-label={tTour("guide.open")}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border pl-2.5 pr-3 text-[10px] uppercase tracking-[1px] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Sparkles className="size-3" aria-hidden="true" />
                {tTour("guide.button")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{tTour("guide.open")}</TooltipContent>
          </Tooltip>

          <PortfolioPill />
          <SharedWorkspacePill />

          <span data-tour-id="header-theme" className="inline-flex">
            <ThemeToggle />
          </span>

          <span data-tour-id="header-bell" className="inline-flex">
            <NotificationBell />
          </span>

          {freeCredit && (
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.5px] tabular-nums ${
                freeCredit.spent ? "border-destructive/40 text-destructive" : "border-brand-gold/50 text-foreground"
              }`}
            >
              <span className="rounded-full bg-brand-gold px-1.5 py-px text-[9px] uppercase tracking-[1px] text-brand-gold-foreground">
                {t("userMenu.trialBadge")}
              </span>
              {freeCredit.spent ? t("userMenu.creditSpent") : t("userMenu.creditLeft", { amount: usd.format(freeCredit.leftUsd) })}
            </span>
          )}

          <div className="relative" ref={userMenuRef}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border border-border text-[10px] font-semibold tracking-[0.5px] cursor-pointer transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isUserMenuOpen ? "border-foreground" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-label={t("userMenu.accountMenu")}
                  data-tour-id="header-account"
                >
                  <UserAvatar avatarUrl={user?.avatarUrl} initials={initials} className="h-full w-full" />
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
                {freeCredit && (
                  <div className="px-4 py-2.5 border-b border-border">
                    <span className="inline-block rounded-full bg-brand-gold px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[1px] text-brand-gold-foreground">
                      {t("userMenu.trialAccount")}
                    </span>
                    <p className={`mt-1.5 text-[11px] tabular-nums ${freeCredit.spent ? "text-destructive" : "text-foreground"}`}>
                      {freeCredit.spent
                        ? t("userMenu.creditSpent")
                        : t("userMenu.creditLeftOf", { amount: usd.format(freeCredit.leftUsd), total: usd.format(freeCredit.creditUsd) })}
                    </p>
                    {freeCredit.spent && <p className="mt-1 text-[10px] text-muted-foreground">{t("userMenu.creditSpentHint")}</p>}
                  </div>
                )}
                {accountAllowance?.limited && (
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="text-[10px] uppercase tracking-[1px] text-muted-foreground">{t("userMenu.aiBalanceLabel")}</p>
                    <p className={`mt-1 text-[11px] tabular-nums ${accountAllowance.locked ? "text-destructive" : "text-foreground"}`}>
                      {accountAllowance.locked
                        ? t("userMenu.aiBalanceSpent")
                        : t("userMenu.aiBalanceLeft", { amount: usd.format(accountAllowance.remainingUsd ?? 0), pct: accountAllowance.consumedPct ?? 0 })}
                    </p>
                  </div>
                )}

                {USER_MENU_ITEMS.map((item) =>
                  trialLocked(item.href) ? (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <span
                          role="menuitem"
                          aria-disabled="true"
                          className="flex cursor-default items-center gap-2 px-4 py-2.5 text-[10px] tracking-[1px] uppercase text-muted-foreground opacity-50"
                        >
                          <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
                          {t(item.labelKey)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left">{t("trial.notIncluded")}</TooltipContent>
                    </Tooltip>
                  ) : (
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
                  ),
                )}

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
         * page owns its own trigger instead (mobileHeaderMerged) — see its comment above. */}
        {!mobileHeaderMerged && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleMobileMenu}
                data-tour-id="header-menu"
                className="lg:hidden p-2 -mr-2 cursor-pointer bg-transparent border-0 text-foreground rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      {/* Mobile menu — a roomy sheet (not the old 300px-capped sliver that read as a shrunk
       * desktop dropdown), structured like a native mobile nav: identity up top, primary
       * destinations as a real icon+label list with full touch targets, utilities and account
       * links grouped underneath, sign-out pinned to the bottom regardless of content height. */}
      <MobileDrawer
        open={isMobileMenuOpen}
        onClose={closeMobileMenu}
        closeLabel={t("mobileMenu.close")}
        side="right"
        panelClassName="flex w-[88%] max-w-[380px] flex-col overflow-y-auto border-l border-border bg-background shadow-2xl"
      >
        {user && (
          <div className="flex items-center gap-3 border-b border-border px-5 py-5">
            <UserAvatar
              avatarUrl={user.avatarUrl}
              initials={initials}
              className="h-11 w-11 border border-border text-xs font-semibold tracking-[0.5px] text-foreground"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{user.name ?? user.username}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />

              <Tooltip>
                <TooltipTrigger asChild>
                  <NotificationBellTrigger
                    open={false}
                    hasUnread={mobileNotificationState.hasUnread}
                    unreadCount={mobileNotificationState.unreadCount}
                    isReconnecting={mobileNotificationState.isReconnecting}
                    onClick={() => {
                      closeMobileMenu();
                      router.push("/homepage/notifications");
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="left">
                  {mobileNotificationState.isReconnecting ? t("notifications.reconnecting") : t("notifications.label")}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        <nav className="flex flex-col gap-1 px-3 py-3">
          {mobileNavItems.map((item) => (
            <Tooltip key={item.tab}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  onClick={closeMobileMenu}
                  data-tour-id={"tourId" in item ? item.tourId : undefined}
                  className={getMobileTabClass(item.tab)}
                >
                  <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                  <TabLinkContent>{t(item.labelKey)}</TabLinkContent>
                  {item.tab === "client-requests" && clientRequestsCount > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-brand-gold-foreground">
                      {clientRequestsCount}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left">{item.tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </nav>

        <div className="border-t border-border px-5 py-3.5">
          <LanguageSwitcher variant="inline" />
        </div>

        <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  openGuide(true);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-[13px] tracking-[1px] uppercase text-foreground transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Sparkles className="size-4 shrink-0" aria-hidden="true" />
                {tTour("guide.open")}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{tTour("guide.open")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  openFeedback();
                }}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-[13px] tracking-[1px] uppercase text-foreground transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <MessageSquareText className="size-4 shrink-0" aria-hidden="true" />
                {t("feedback.open", { defaultValue: "Send feedback" })}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{t("feedback.open", { defaultValue: "Send feedback" })}</TooltipContent>
          </Tooltip>
          {USER_MENU_ITEMS.map((item) =>
            trialLocked(item.href) ? (
              <span
                key={item.href}
                aria-disabled="true"
                title={t("trial.notIncluded")}
                className="flex cursor-default items-center gap-3 rounded-lg px-3 py-3 text-[13px] tracking-[1px] uppercase text-muted-foreground opacity-50"
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {t(item.labelKey)}
              </span>
            ) : (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] tracking-[1px] uppercase text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {t(item.labelKey)}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="left">{item.tooltip}</TooltipContent>
              </Tooltip>
            ),
          )}
        </div>

        {/* mt-auto pins sign-out to the bottom of the sheet regardless of how much content is
         * above it — the one destructive action gets its own fixed spot, not just "last in a
         * scrolling list." */}
        <div className="mt-auto border-t border-border px-3 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={logout.isPending}
                onClick={() => {
                  closeMobileMenu();
                  logout.mutate();
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-[13px] tracking-[1px] uppercase text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-danger/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="size-4 shrink-0" aria-hidden="true" />
                {logout.isPending ? t("userMenu.loggingOut") : t("userMenu.logout")}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Sign out of your account</TooltipContent>
          </Tooltip>
        </div>
      </MobileDrawer>
    </header>
  );
}
