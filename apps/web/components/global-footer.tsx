// apps/web/components/global-footer.tsx
import React from "react";

const RESEARCH_LINKS = [
  { label: "Constitution", href: "/homepage/constitution" },
  { label: "Civil Code", href: "/homepage/civil-code" },
  { label: "SCRA Archive", href: "/homepage/scra-archive" },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/homepage/privacy-policy" },
  { label: "Terms of Use", href: "/homepage/term" },
  { label: "Ethics Policy", href: "/homepage/ethics-policy" },
] as const;

const CONNECT_LINKS = [
  { label: "Support Center", href: "/homepage/support-center" },
  { label: "Media Inquiries", href: "/homepage/media-inquiries" },
  { label: "Contact Us", href: "/homepage/contact-us" },
] as const;

export default function GlobalFooter() {
  return (
    <footer className="w-full bg-background border-t border-border py-16 relative z-10">
      <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex flex-col lg:flex-row items-start justify-between gap-12">
        <div className="flex flex-col gap-4 max-w-sm">
          <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-foreground">ilovelawyer</span>
          <p className="text-sm text-muted-foreground leading-relaxed font-normal">
            Dedicated to providing the legal community with the most advanced digital research tools in the Philippines.
          </p>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
            © 2026 ILOVELAWYER PHILIPPINES. ALL RIGHTS RESERVED.
          </p>
        </div>

        <div className="flex gap-x-16 gap-y-8 flex-wrap text-xs font-semibold text-muted-foreground">
          <div className="flex flex-col gap-3 min-w-[100px]">
            <span className="text-foreground tracking-wider uppercase text-[11px]">RESEARCH</span>
            {RESEARCH_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-foreground font-normal">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-3 min-w-[100px]">
            <span className="text-foreground tracking-wider uppercase text-[11px]">LEGAL</span>
            {LEGAL_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-foreground font-normal">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-3 min-w-[100px]">
            <span className="text-foreground tracking-wider uppercase text-[11px]">CONNECT</span>
            {CONNECT_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-foreground font-normal">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
