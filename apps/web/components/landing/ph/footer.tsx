"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

const COLUMNS = [
  {
    columnKey: "product",
    links: [
      { key: "aiConsultation", href: "#capabilities" },
      { key: "caseFiles", href: "#capabilities" },
      { key: "caseWorkspace", href: "#control" },
      { key: "legalTerminal", href: "#control" },
      { key: "researchLibrary", href: "#capabilities" },
    ],
  },
  {
    columnKey: "firms",
    links: [
      { key: "plansAndPricing", href: "#business" },
      { key: "rolesAndPermissions", href: "#business" },
      { key: "inviteYourTeam", href: "#business" },
      { key: "firmSettings", href: "#business" },
    ],
  },
  {
    columnKey: "jurisdictions",
    links: [{ key: "philippines", href: "#business" }],
  },
  {
    columnKey: "resources",
    links: [
      { key: "helpCentre", href: "mailto:support@ilovelawyer.ph" },
      { key: "transcription", href: "#capabilities" },
      { key: "documentUpload", href: "#capabilities" },
      { key: "calendar", href: "#capabilities" },
    ],
  },
  {
    columnKey: "company",
    links: [
      { key: "aboutUs", href: "#" },
      { key: "careers", href: "#" },
      { key: "termsOfService", href: "#" },
      { key: "privacyPolicy", href: "#" },
      { key: "accessibility", href: "#" },
    ],
  },
] as const;

export function LandingFooter() {
  const { t } = useTranslation("landing");
  const year = new Date().getFullYear();

  return (
    <footer id="footer" className="bg-brand-navy-900 text-white py-16 px-6 md:px-16">
      <div className="max-w-[1440px] mx-auto">
        <Link
          href="/"
          className="mb-4 inline-block hover:opacity-70 transition-opacity duration-200"
          aria-label="ilovelawyer"
        >
          <Logo forBackground="dark" size={28} />
        </Link>
        <p className="text-white/60 text-sm max-w-[420px] mb-12">{t("footer.tagline")}</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {COLUMNS.map((col) => (
            <div key={col.columnKey} className="flex flex-col gap-3 text-sm">
              <span className="text-[13px] text-white/50">{t(`footer.columns.${col.columnKey}.heading`)}</span>
              {col.links.map((link) => (
                <Tooltip key={link.key}>
                  <TooltipTrigger asChild>
                    <Link href={link.href} className="text-white/80 hover:text-white transition-colors duration-200">
                      {t(`footer.columns.${col.columnKey}.links.${link.key}`)}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>{t(`footer.columns.${col.columnKey}.links.${link.key}`)}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>

        <div className="pt-5 border-t border-brand-oxblood/60 flex items-center justify-between gap-6 flex-wrap text-[13px] text-white/70">
          <LanguageSwitcher />
          <span>{t("footer.jurisdictionLine")}</span>
          <span>&copy; {year} ilovelawyer</span>
        </div>
      </div>
    </footer>
  );
}
