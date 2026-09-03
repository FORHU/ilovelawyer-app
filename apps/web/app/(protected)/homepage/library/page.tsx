"use client";
import GlobalHeader from "@/components/global-header";
import { LawSearchPanel } from "@/components/library/law-search-panel";
import { useTenantCodeFeatureGuard } from "@/components/tenant-code-feature-guard";

export default function LegalLibraryPage() {
  const guard = useTenantCodeFeatureGuard("legalSearch", "library", {
    eyebrow: "Research · Library",
    heading: "Not available for your jurisdiction",
    body: (displayName) => `The legal research library isn't available for ${displayName} organizations yet.`,
  });

  if (guard) return guard;

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="library" />

      <main className="w-full flex flex-col flex-1 pt-14">
        <LawSearchPanel />
      </main>
    </div>
  );
}
