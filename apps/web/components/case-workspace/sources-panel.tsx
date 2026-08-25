"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Files, Link2, PanelLeft, PanelLeftClose } from "lucide-react";
import { DocumentUploadButton, CaseDocumentList } from "@/components/cases/case-details-panel";
import { HubRelatedCases } from "@/components/chat/case-hub-widget";
import { useRelatedCasesQuery } from "@/lib/chat/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

type SourcesTab = "documents" | "related";

interface SourcesPanelProps {
  caseId: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Related Cases is per-consultation (legal-precedent citations the AI surfaced for that
   * thread's latest reply), not per-case — so it follows whichever thread ThreadPicker has
   * active, not a document selection of its own. */
  activeConsultationId: string | null;
}

/** Case Workspace's left panel — Documents (this case's Case Documents, upload/list/delete
 * reused as-is from case-details-panel.tsx) and Related Cases (this consultation's AI-surfaced
 * legal-precedent citations, reused from case-hub-widget.tsx). Collapses to a slim rail. */
export function SourcesPanel({ caseId, expanded, onExpandedChange, activeConsultationId }: SourcesPanelProps) {
  const { t } = useTranslation("case-portfolio");
  const [tab, setTab] = useState<SourcesTab>("documents");
  const { data: relatedData, isLoading: isLoadingRelated } = useRelatedCasesQuery(
    tab === "related" && activeConsultationId ? activeConsultationId : undefined,
  );

  return (
    <aside
      className={`flex h-full min-h-0 shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ${
        expanded ? "w-80" : "w-14"
      }`}
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b border-border ${
          expanded ? "justify-between px-4" : "justify-center"
        }`}
      >
        {expanded && (
          <span className="text-[13px] font-semibold text-foreground">{t("workspace.sources")}</span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              aria-label={expanded ? t("workspace.collapseSources") : t("workspace.expandSources")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {expanded ? (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeft className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {expanded ? t("workspace.collapseSources") : t("workspace.expandSources")}
          </TooltipContent>
        </Tooltip>
      </div>

      {!expanded && (
        <div className="flex flex-1 flex-col items-center gap-3 pt-3">
          <Files className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      {expanded && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 px-3 pt-3">
            <button
              type="button"
              onClick={() => setTab("documents")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === "documents" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Files className="h-3.5 w-3.5" aria-hidden="true" />
              {t("workspace.documentsTab")}
            </button>
            <button
              type="button"
              onClick={() => setTab("related")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === "related" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("workspace.relatedTab")}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === "documents" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {t("detail.documents")}
                  </span>
                  <DocumentUploadButton caseId={caseId} />
                </div>
                <CaseDocumentList caseId={caseId} listClassName="max-h-[70vh]" />
              </div>
            ) : activeConsultationId ? (
              <HubRelatedCases
                entries={relatedData?.relatedCases ?? []}
                isLoading={isLoadingRelated}
                emptyLabel={t("workspace.relatedEmpty")}
              />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("workspace.relatedNoConsultation")}
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
