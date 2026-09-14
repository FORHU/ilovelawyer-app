"use client";
import { PageShell } from "@/components/page-shell";
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
    <PageShell activeTab="library">
      <main className="w-full flex flex-col flex-1 pt-16">
        <LawSearchPanel />
      </main>
    </PageShell>
  );
}
