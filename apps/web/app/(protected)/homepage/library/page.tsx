"use client";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { LawSearchPanel } from "@/components/library/law-search-panel";
import { useTenantCodeFeatureGuard } from "@/components/tenant-code-feature-guard";

export default function LegalLibraryPage() {
  const guard = useTenantCodeFeatureGuard("legalSearch", {
    eyebrow: "Research · Library",
    heading: "Not available for your jurisdiction",
    body: (displayName) => `The legal research library isn't available for ${displayName} organizations yet.`,
  });

  if (guard) return guard;

  return (
    <PageShell>
      <main className="w-full flex flex-col flex-1 pt-16">
        {/* LawSearchPanel reads its filters from useSearchParams — Next wants a Suspense boundary
            around that for prerendering. */}
        <Suspense fallback={null}>
          <LawSearchPanel />
        </Suspense>
      </main>
    </PageShell>
  );
}
