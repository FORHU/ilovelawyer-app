import { headers } from "next/headers";
import { LandingNavbar } from "@/components/landing/navbar";
import { NeutralLandingSplash } from "@/components/landing/neutral-splash";
import { HeroSection } from "@/components/landing/ph/hero-section";
import { FeaturesSection } from "@/components/landing/ph/features-section";
import { QuoteSection } from "@/components/landing/ph/quote-section";
import { LandingFooter } from "@/components/landing/ph/footer";
import { UkHeroSection } from "@/components/landing/uk/hero-section";
import { UkFeaturesSection } from "@/components/landing/uk/features-section";
import { UkQuoteSection } from "@/components/landing/uk/quote-section";
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
      <div className="flex flex-col min-h-screen w-full bg-[#f7fafc] dark:bg-background">
        <LandingNavbar />
        <NeutralLandingSplash currentHost={host} />
      </div>
    );
  }

  const isUk = tenantCode === "UK";

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#f7fafc] dark:bg-background">
      <LandingNavbar />
      <main className="flex-1">
        {isUk ? <UkHeroSection /> : <HeroSection />}
        {isUk ? <UkFeaturesSection /> : <FeaturesSection />}
        {isUk ? <UkQuoteSection /> : <QuoteSection />}
      </main>
      {isUk ? <UkLandingFooter /> : <LandingFooter />}
    </div>
  );
}
