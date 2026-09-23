import type { Metadata } from "next";
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
import { getRequestOrigin } from "@/lib/tenant-code/get-request-origin";
import { getTenantCodeConfig } from "@/config/tenant-codes";
import { hostForTenantCode, protocolForHost } from "@/lib/tenant-code/resolve-host";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// Tenant-branching SEO copy for generateMetadata (title/description/OG/Twitter) below —
// hardcoded here rather than routed through i18next since metadata is generated server-side
// before any client-side language state exists (<html lang="en"> is already hardcoded, no
// cookie/header carries the in-app language choice to the server).
const TENANT_SEO: Record<TenantCode, { title: string; description: string }> = {
  UK: {
    title: "ilovelawyer UK — AI Legal Intelligence for Lawyers",
    description:
      "Case management, AI consultation with cited UK precedent, and a Legal Terminal built for practicing lawyers.",
  },
  PH: {
    title: "ilovelawyer — AI Legal Intelligence for Philippine Lawyers",
    description:
      "Case management, AI consultation with cited Philippine jurisprudence, and a Legal Terminal built for practicing lawyers.",
  },
};

// ISO 3166-1 alpha-2, per schema.org's `areaServed` convention — not the tenant code itself
// ("UK" isn't the ISO country code; "GB" is).
const AREA_SERVED: Record<TenantCode, string> = { UK: "GB", PH: "PH" };

// This is a SaaS product used BY lawyers, not a provider of legal services to the public —
// deliberately `SoftwareApplication`, not schema.org's `LegalService` type, so the structured
// data doesn't misrepresent ilovelawyer itself as a law firm/legal service provider. Only
// facts we can actually stand behind go in here (no invented ratings/pricing/address).
function buildStructuredData(tenantCode: TenantCode, origin: string) {
  const { description } = TENANT_SEO[tenantCode];
  const config = getTenantCodeConfig(tenantCode);

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ilovelawyer",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${origin}/`,
    image: `${origin}/opengraph-image.png`,
    description,
    areaServed: AREA_SERVED[tenantCode],
    inLanguage: config.locale,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const tenantCode = await getTenantCodeHint();

  if (tenantCode === null) {
    // Bare apex / app.ilovelawyer.com: the neutral splash is a two-link jurisdiction picker
    // with no unique content of its own — keep it out of search entirely (matches this
    // host's blanket robots.txt disallow).
    return { robots: { index: false, follow: false } };
  }

  const { title, description } = TENANT_SEO[tenantCode];
  const config = getTenantCodeConfig(tenantCode);

  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const protocol = protocolForHost(host);
  const ukUrl = `${protocol}://${hostForTenantCode("UK", host)}/`;
  const phUrl = `${protocol}://${hostForTenantCode("PH", host)}/`;

  return {
    title: { absolute: title }, // bypass the root layout's "%s · ilovelawyer" template —
    // this is the homepage, it gets the full brand title as-is
    description,
    alternates: {
      canonical: "/", // resolves against the root layout's per-request metadataBase to
      // this host's own absolute URL — must stay self-referencing per host, never collapsed
      // onto one canonical domain, since PH and UK are different content at the same
      // relative path
      languages: {
        "en-GB": ukUrl,
        "en-PH": phUrl,
        // Tells Google which version to fall back to for a searcher whose locale matches
        // neither annotated variant — points at PH since getTenantCodeConfig() already
        // treats PH as the display default when a tenant is unresolved.
        "x-default": phUrl,
      },
    },
    openGraph: {
      title,
      description,
      url: "/",
      siteName: "ilovelawyer",
      locale: config.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true }, // overrides the root layout's default-deny
  };
}

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
        <LandingNavbar overHero={false} />
        {/* The redesigned navbar is `fixed` (it floats transparently over the hero video on
            the tenant pages below) so it no longer reserves layout space — this page has no
            hero to sit under it, so it needs its own top offset instead. */}
        <div className="pt-16 flex-1 flex flex-col">
          <NeutralLandingSplash currentHost={host} />
        </div>
      </div>
    );
  }

  const origin = await getRequestOrigin();
  const structuredData = buildStructuredData(tenantCode, origin);
  // dangerouslySetInnerHTML is safe here — structuredData is built entirely from this file's
  // own hardcoded TENANT_SEO/config values, never from user input.
  const jsonLdScript = (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
  );

  if (tenantCode === "UK") {
    return (
      <div className="flex flex-col min-h-screen w-full bg-background">
        {jsonLdScript}
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
      {jsonLdScript}
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
