"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

const companyLinks = [
  { key: "aboutUs", href: "#" },
  { key: "contactSupport", href: "mailto:support@ilovelawyer.ph" },
  { key: "compliance", href: "#" },
] as const;

const legalLinks = [
  { key: "privacyPolicy", href: "#" },
  { key: "termsOfService", href: "#" },
  { key: "securityDataSovereignty", href: "#" },
] as const;

export function LandingFooter() {
  const { t } = useTranslation("landing");
  return (
    <footer className="bg-[#f1f4f6] dark:bg-muted border-t border-[#c6c6ce] dark:border-border py-12 px-8 md:px-16">
      <div className="max-w-360 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
          <div className="md:col-span-4 flex flex-col gap-5">
            <Link href="/" className="cursor-pointer w-fit">
              <span className="text-[28px] text-black dark:text-foreground hover:opacity-70 transition-opacity duration-200" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
                ilovelawyer
              </span>
            </Link>
            <p className="text-[#45464d] dark:text-muted-foreground text-base leading-[1.6] pr-8" style={{ fontFamily: "Inter, sans-serif" }}>
              {t("footer.tagline")}
            </p>
          </div>

          <div className="md:col-span-2 flex flex-col gap-6">
            <h4 className="text-black dark:text-foreground text-xs tracking-[1.2px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>{t("footer.company.heading")}</h4>
            <div className="flex flex-col gap-4">
              {companyLinks.map(({ key, href }) => (
                <Link
                  key={key}
                  href={href}
                  className="text-[#45464d] dark:text-muted-foreground text-base text-left hover:text-black dark:hover:text-foreground transition-colors duration-200 leading-6"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {t(`footer.company.${key}`)}
                </Link>
              ))}
            </div>
          </div>

          <div className="md:col-span-4 flex flex-col gap-6">
            <h4 className="text-black dark:text-foreground text-xs tracking-[1.2px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>{t("footer.legal.heading")}</h4>
            <div className="flex flex-col gap-4">
              {legalLinks.map(({ key, href }) => (
                <Link
                  key={key}
                  href={href}
                  className="text-[#45464d] dark:text-muted-foreground text-base text-left hover:text-black dark:hover:text-foreground underline decoration-[#c6c6ce] dark:decoration-border hover:decoration-black dark:hover:decoration-foreground transition-colors duration-200 leading-6"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {t(`footer.legal.${key}`)}
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
