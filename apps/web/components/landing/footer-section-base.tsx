"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { FooterRevealPortal } from "@/components/landing/footer-reveal-portal";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from "@/lib/i18n/languages";
import { useLanguageStore } from "@/lib/store/language.store";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// PH and UK render the same footer shell (see hero-section-base.tsx for why this is one
// component instead of two hand-copied files), but their column links genuinely differ
// (different jurisdiction, different support email, transcription linked differently) —
// so, unlike the other merged sections, this one branches on real per-tenant data rather
// than just an i18next context suffix.

const PH_COLUMNS = [
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
  { columnKey: "jurisdictions", links: [{ key: "philippines", href: "#business" }] },
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

const UK_COLUMNS = [
  PH_COLUMNS[0],
  PH_COLUMNS[1],
  { columnKey: "jurisdictions", links: [{ key: "unitedKingdom", href: "#business" }] },
  {
    columnKey: "resources",
    links: [
      { key: "helpCentre", href: "mailto:support@uk.ilovelawyer.com" },
      { key: "transcription", href: "/homepage/transcription" },
      { key: "documentUpload", href: "#capabilities" },
      { key: "calendar", href: "#capabilities" },
    ],
  },
  PH_COLUMNS[4],
] as const;

export function FooterSectionBase({ tenantCode }: { tenantCode: TenantCode }) {
  const { t } = useTranslation("landing");
  const tCtx = tenantCode === "UK" ? { context: "UK" as const } : undefined;
  const columns = tenantCode === "UK" ? UK_COLUMNS : PH_COLUMNS;
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  return (
    <FooterRevealPortal>
      <footer id="footer" className="bg-brand-navy-900 text-white py-16 px-6 md:px-16">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {columns.map((col) => (
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

          <div className="pt-5 border-t border-white/[0.16] flex items-center justify-between gap-6 flex-wrap text-[13px] text-white/70">
            <div className="flex gap-2.5">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  aria-pressed={language === lang}
                  className={`rounded-full border px-3 py-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    language === lang
                      ? "border-white/70 text-white"
                      : "border-white/30 hover:border-white/60 hover:text-white"
                  }`}
                >
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>
            <span>{t("footer.jurisdictionLine", tCtx)}</span>
            <span>&copy; ilovelawyer</span>
          </div>
        </div>
      </footer>
    </FooterRevealPortal>
  );
}
