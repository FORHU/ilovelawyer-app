"use client";

import { useTranslation } from "react-i18next";

const LINK_GROUPS = [
  {
    headingKey: "research.heading",
    links: [
      { key: "research.constitution", href: "#const" },
      { key: "research.civilCode", href: "#civil" },
      { key: "research.scraArchive", href: "#scra" },
    ],
  },
  {
    headingKey: "legal.heading",
    links: [
      { key: "legal.privacyPolicy", href: "/homepage/term" },
      { key: "legal.termsOfUse", href: "/homepage/term" },
      { key: "legal.ethicsPolicy", href: "/homepage/term" },
    ],
  },
  {
    headingKey: "connect.heading",
    links: [
      { key: "connect.supportCenter", href: "#support" },
      { key: "connect.mediaInquiries", href: "#media" },
      { key: "connect.contactUs", href: "#contact" },
    ],
  },
] as const;

/** Shared bottom footer for the protected-app dashboard pages (Case Portfolio, Create Case, Document Analysis, Library, Transcription, Profile). */
export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("common");

  return (
    <footer className={`w-full bg-white border-t border-gray-200 relative z-10 ${compact ? "py-10" : "py-16"}`}>
      <div className={`max-w-[1440px] mx-auto px-6 md:px-16 flex flex-col lg:flex-row items-start justify-between ${compact ? "gap-10" : "gap-12"}`}>
        <div className="flex flex-col gap-4 max-w-sm">
          <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-black">{t("appName")}</span>
          <p className="text-sm text-gray-500 leading-relaxed font-normal">{t("siteFooter.tagline")}</p>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-1">
            {t("siteFooter.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>

        <div className="flex gap-x-16 gap-y-8 flex-wrap text-xs font-semibold text-gray-500">
          {LINK_GROUPS.map((group) => (
            <div key={group.headingKey} className={`flex flex-col gap-3 ${compact ? "min-w-25" : "min-w-[100px]"}`}>
              <span className="text-black tracking-wider uppercase text-[11px]">{t(`siteFooter.${group.headingKey}`)}</span>
              {group.links.map((link) => (
                <a key={link.key} href={link.href} className="hover:text-black font-normal">
                  {t(`siteFooter.${link.key}`)}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
