"use client";
import { useParams } from "next/navigation";
import GlobalHeader from "@/components/global-header";
import { CaseWorkspace } from "@/components/case-workspace/case-workspace";

export default function CaseWorkspacePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <GlobalHeader activeTab="case-portfolio" />
      {/* pt-16 clears the header — GlobalHeader is `absolute`, so it reserves no flex-flow
          height of its own (same compensation ConsultationChat's non-embedded mode applies). */}
      <div className="min-h-0 flex-1 pt-16">
        <CaseWorkspace caseId={id} />
      </div>
    </div>
  );
}
