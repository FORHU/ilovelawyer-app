"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, AlertCircle } from "lucide-react";
import { useCaseQuery } from "@/lib/cases/mutations";

interface CaseDetailsPanelProps {
  caseId: string;
}

/** Right-anchored "case chip" that opens the full details as a dropdown popover — sits
 * beside the back link as a single compact header row instead of stacking its own block
 * (and its own border) into the page. The popover itself is allowed a border/shadow since
 * it's a transient overlay, not another permanent card competing with the chat input. */
export default function CaseDetailsPanel({ caseId }: CaseDetailsPanelProps) {
  const { t } = useTranslation("case-portfolio");
  const [expanded, setExpanded] = useState(false);
  const { data: caseRecord, isLoading, isError, error } = useCaseQuery(caseId);
  const notFound = isError && error instanceof Error && error.message.toLowerCase().includes("not found");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expanded]);

  if (isLoading) {
    return <span className="text-sm text-muted-foreground">{t("detail.loading")}</span>;
  }

  if (isError) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-red-600">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {notFound ? t("detail.notFound") : t("detail.loadError")}
      </span>
    );
  }

  if (!caseRecord) return null;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex max-w-60 items-center gap-2 rounded-full py-1.5 pl-1 pr-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span className="shrink-0 rounded-full bg-primary/5 px-2 py-1 text-[10px] font-bold tracking-wider text-primary uppercase">
          {t("detail.caseLabel")}
        </span>
        <span className="truncate font-['Libre_Caslon_Text'] text-sm text-foreground font-normal">
          {caseRecord.caseName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-lg p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t("detail.party")}
            </span>
            <span className="text-sm text-foreground">
              {caseRecord.partyInvolved || t("noPartyListed")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t("detail.created")}
              </span>
              <span className="text-sm text-foreground">
                {new Date(caseRecord.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t("detail.updated")}
              </span>
              <span className="text-sm text-foreground">
                {new Date(caseRecord.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1 border-t border-border pt-4">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t("detail.notes")}
            </span>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {caseRecord.notes || t("detail.noNotes")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
