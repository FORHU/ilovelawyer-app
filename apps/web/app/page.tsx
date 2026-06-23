import { LandingNavbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { InActionSection } from "@/components/landing/in-action-section";
import { ProcessSection } from "@/components/landing/process-section";
import { CTASection } from "@/components/landing/cta-section";
import { SharedFooter } from "@/components/shared-footer";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen w-full" style={{ background: "linear-gradient(90deg, #f7f9fb 0%, #f7f9fb 100%)" }}>
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <InActionSection />
        <ProcessSection />
        <CTASection />
      </main>
      <SharedFooter />
    </div>
  );
}
