"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuthStore } from "@/lib/store/auth.store";
import { ThemeToggle } from "@/components/theme-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function LandingNavbar() {
  const { t } = useTranslation("landing");
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  return (
    <header className="backdrop-blur-md bg-[rgba(247,250,252,0.85)] dark:bg-background/85 w-full border-b border-[rgba(198,198,206,0.3)] dark:border-border sticky top-0 z-50">
      <div className="max-w-360 mx-auto flex items-center justify-between px-8 md:px-16 py-5">
        <Link href="/" className="cursor-pointer">
          <span className="text-[28px] text-black dark:text-foreground tracking-[-0.7px]" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
            ilovelawyer
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-6">
          <ThemeToggle />
          <LanguageSwitcher />
          {isAuthenticated ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/homepage"
                  className="bg-black text-white dark:bg-primary dark:text-primary-foreground text-xs tracking-[1.2px] uppercase px-6 py-2.5 hover:bg-[#1a1a1a] dark:hover:bg-primary/90 transition-colors duration-200"
                  style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
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
                    className="text-[#45464d] dark:text-muted-foreground text-base hover:text-black dark:hover:text-foreground transition-colors duration-200"
                    style={{ fontFamily: "Inter, sans-serif" }}
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
                    className="bg-black text-white dark:bg-primary dark:text-primary-foreground text-xs tracking-[1.2px] uppercase px-6 py-2.5 hover:bg-[#1a1a1a] dark:hover:bg-primary/90 transition-colors duration-200"
                    style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
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
              className="lg:hidden p-2 cursor-pointer bg-transparent border-0"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? t("navbar.closeMenu") : t("navbar.openMenu")}
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M6 14L14 6" />
                </svg>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="w-5 h-0.5 bg-black dark:bg-foreground" />
                  <div className="w-5 h-0.5 bg-black dark:bg-foreground" />
                  <div className="w-5 h-0.5 bg-black dark:bg-foreground" />
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{mobileOpen ? t("navbar.closeMenu") : t("navbar.openMenu")}</TooltipContent>
        </Tooltip>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-[#f7fafc] dark:bg-background border-t border-[rgba(198,198,206,0.3)] dark:border-border px-8 py-6 flex flex-col gap-4">
          <div className="pt-1 flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
          <div className="flex gap-3 mt-2">
            {isAuthenticated ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/homepage"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 bg-black text-white dark:bg-primary dark:text-primary-foreground text-xs px-4 py-3 text-center hover:bg-[#1a1a1a] dark:hover:bg-primary/90 transition-colors duration-200"
                    style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
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
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 border border-black text-black dark:border-foreground dark:text-foreground text-xs px-4 py-3 text-center hover:bg-black/5 dark:hover:bg-foreground/5 transition-colors duration-200"
                      style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
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
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 bg-black text-white dark:bg-primary dark:text-primary-foreground text-xs px-4 py-3 text-center hover:bg-[#1a1a1a] dark:hover:bg-primary/90 transition-colors duration-200"
                      style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                    >
                      {t("navbar.getStarted")}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Create your free account</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
