"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, AlertCircle, Network, Clock } from "lucide-react";
import { useCaseQuery } from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

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
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>Show case details: party, dates, and notes</TooltipContent>
      </Tooltip>

      {expanded && (
        // Fixed + viewport-anchored below sm: the trigger sits hard against the right edge
        // of a full-width header row, so a popover positioned relative to it (the old
        // `absolute right-0 w-80`) always overhung far past the screen's left edge on phones.
        // From sm: up there's enough room for the compact, trigger-anchored version.
        <div className="fixed inset-x-4 top-24 z-20 rounded-xl border border-border bg-card shadow-lg p-5 flex flex-col gap-4 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-2rem)]">
          <div className="flex flex-col gap-1 -mx-1">
            <CaseToolRow icon={Network} label={t("MindMap")} />
            <CaseToolRow icon={Clock} label={t("Timeline")} />
          </div>

          <div className="flex flex-col gap-1 border-t border-border pt-4">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t("detail.party")}
            </span>
            <span className="text-sm text-foreground">
              {caseRecord.parties.length > 0
                ? caseRecord.parties.map((p) => `${p.name} (${p.designation})`).join("; ")
                : t("noPartyListed")}
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

/** Placeholder entry point for a not-yet-built case tool — styled and clickable now so it
 * reads as a real menu item, wired up once the tool behind it exists. */
function CaseToolRow({ icon: Icon, label }: { icon: typeof Network; label: string }) {
  return (
    <button
      type="button"
      className="group flex items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{label}</span>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}
