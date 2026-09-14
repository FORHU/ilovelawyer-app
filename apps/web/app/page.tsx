import { headers } from "next/headers";
import { LandingNavbar } from "@/components/landing/navbar";
import { NeutralLandingSplash } from "@/components/landing/neutral-splash";
import { CapabilitiesSection } from "@/components/landing/capabilities-section";
import { HeroSection } from "@/components/landing/ph/hero-section";
import { FirmQuoteSection } from "@/components/landing/ph/firm-quote-section";
import { TerminalShowcaseSection } from "@/components/landing/ph/terminal-showcase-section";
import { ConsultationSection } from "@/components/landing/ph/consultation-section";
import { FirmsSection } from "@/components/landing/ph/firms-section";
import { LandingFooter } from "@/components/landing/ph/footer";
import { UkHeroSection } from "@/components/landing/uk/hero-section";
import { UkFirmQuoteSection } from "@/components/landing/uk/firm-quote-section";
import { UkTerminalShowcaseSection } from "@/components/landing/uk/terminal-showcase-section";
import { UkConsultationSection } from "@/components/landing/uk/consultation-section";
import { UkFirmsSection } from "@/components/landing/uk/firms-section";
import { UkLandingFooter } from "@/components/landing/uk/footer";
import { getTenantCodeHint } from "@/lib/tenant-code/get-tenant-code-hint";

export default async function LandingPage() {
  const tenantCode = await getTenantCodeHint();

  // Unresolved host — the bare apex (ilovelawyer.com) and app.ilovelawyer.com alike (the
  // latter is no longer treated as a special standalone entry point, see
  // app/(protected)/layout.tsx) — gets a neutral splash instead of silently defaulting to
  // either tenant's design.
  if (tenantCode === null) {
    const headersList = await headers();
    const host = headersList.get("host") ?? "";
    return (
      <div className="flex flex-col min-h-screen w-full bg-background">
        <LandingNavbar />
        <NeutralLandingSplash currentHost={host} />
      </div>
    );
  }

  if (tenantCode === "UK") {
    return (
      <div className="flex flex-col min-h-screen w-full bg-background">
        <LandingNavbar />
        <main className="flex-1">
          <UkHeroSection />
          <CapabilitiesSection />
          <UkFirmQuoteSection />
          <UkTerminalShowcaseSection />
          <UkConsultationSection />
          <UkFirmsSection />
        </main>
        <UkLandingFooter />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <CapabilitiesSection />
        <FirmQuoteSection />
        <TerminalShowcaseSection />
        <ConsultationSection />
        <FirmsSection />
      </main>
      <LandingFooter />
    </div>
  );
}
