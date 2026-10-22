"use client";

import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";

/** The sign-in page's left half: a fixed navy brand panel with the logo and quote, unaffected by
 * the theme (see reset-password/page.tsx). Hidden below lg. Shared with account setup
 * (OnboardingShell), so the steps after verification look like the ones before it. */
export function AuthBrandPanel() {
  const { t } = useTranslation("auth");
  return (
    <div className="relative hidden lg:flex flex-col" style={{ width: "58%" }}>
      <div className="absolute inset-0 bg-brand-navy-950" />
      <div
        className="absolute inset-0 opacity-70"
        style={{ background: "radial-gradient(ellipse at 40% 50%, var(--brand-navy-800) 0%, var(--brand-navy-950) 65%)" }}
      />

      <div className="absolute top-16 left-16 z-10">
        <Logo forBackground="dark" size={40} />
      </div>

      <div className="absolute inset-0 flex flex-col items-start justify-center pl-16 pr-12 z-10">
        <div className="bg-brand-gold h-0.5 w-12 mb-8" />
        <blockquote className="font-['Libre_Caslon_Text'] italic text-white text-[24px] leading-9.5 max-w-100 mb-5">
          &ldquo;{t("login.quote")}&rdquo;
        </blockquote>
        <p className="text-[rgba(224,227,229,0.45)] text-[11px] tracking-[2.5px] uppercase" style={{ fontFamily: "Inter, sans-serif" }}>
          {t("login.quoteAuthor")}
        </p>
      </div>
    </div>
  );
}
