"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import ConsultationChat from "@/components/chat/consultation-chat";
import { SourcesPanel } from "@/components/case-workspace/sources-panel";
import { StudioPanel } from "@/components/case-workspace/studio-panel";
import { ThreadPicker } from "@/components/case-workspace/thread-picker";

interface CaseWorkspaceProps {
  caseId: string;
}

/** The 3-panel (Sources / Chat / Studio) layout for a case's detail page — see
 * ilovelawyer-app/CONTEXT.md's "Case Workspace" terms and docs/adr/0012-case-workspace-parallel-route.md.
 * The Chat column reuses ConsultationChat's `embedded` mode as-is (streaming, uploads, mic —
 * all unchanged); Sources and Studio are new panels built from already-existing pieces. */
export function CaseWorkspace({ caseId }: CaseWorkspaceProps) {
  const basePath = `/homepage/v2/case-portfolio/${caseId}`;
  const searchParams = useSearchParams();
  const activeConsultationId = searchParams.get("c");

  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  const [studioExpanded, setStudioExpanded] = useState(true);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <SourcesPanel
        caseId={caseId}
        expanded={sourcesExpanded}
        onExpandedChange={setSourcesExpanded}
        activeConsultationId={activeConsultationId}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <ThreadPicker caseId={caseId} activeConsultationId={activeConsultationId} basePath={basePath} />
        </div>
        <div className="min-h-0 flex-1">
          <ConsultationChat embedded caseId={caseId} basePath={basePath} />
        </div>
      </div>

      <StudioPanel
        caseId={caseId}
        consultationId={activeConsultationId}
        expanded={studioExpanded}
        onExpandedChange={setStudioExpanded}
      />
    </div>
  );
}
