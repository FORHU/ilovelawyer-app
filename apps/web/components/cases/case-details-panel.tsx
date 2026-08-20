"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, AlertCircle, Network, Clock, FileText, Plus, Loader2, Trash2 } from "lucide-react";
import {
  useCaseQuery,
  useCaseDocumentsQuery,
  useUploadCaseDocumentMutation,
  useDeleteCaseDocumentMutation,
} from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { RagStatusBadge } from "@/components/cases/rag-status-badge";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Opens ConsultationChat's Mind Map tab for whichever consultation is already selected
  // (?c=, if any — case-portfolio/[id]/page.tsx auto-selects the most recent one on arrival)
  // via the same ?tab=mindmap param ConsultationChat itself reads.
  const openMindMap = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "mindmap");
    router.push(`${pathname}?${params.toString()}`);
    setExpanded(false);
  };

  const openTimeline = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "timeline");
    router.push(`${pathname}?${params.toString()}`);
    setExpanded(false);
  };

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
            <CaseToolRow icon={Network} label={t("tools.mindMap")} onClick={openMindMap} />
            <CaseToolRow icon={Clock} label={t("tools.timeline")} onClick={openTimeline} />
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

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t("detail.documents")}
              </span>
              <DocumentUploadButton caseId={caseId} />
            </div>
            <CaseDocumentList caseId={caseId} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Small trigger + hidden file input that uploads straight into this case — same upload
 * mutation the chat's "Add Document" quick action uses, so a file shows up here regardless
 * of which entry point it was uploaded from. */
function DocumentUploadButton({ caseId }: { caseId: string }) {
  const { t } = useTranslation("case-portfolio");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: uploadDocument, isPending, isError } = useUploadCaseDocumentMutation();

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors hover:border-brand-gold/40 disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
            {isPending ? t("detail.uploading") : t("detail.addDocument")}
          </button>
        </TooltipTrigger>
        <TooltipContent>Upload a document to this case</TooltipContent>
      </Tooltip>
      {isError && <span className="block text-right text-[11px] text-red-600 dark:text-red-400">{t("detail.uploadError")}</span>}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) uploadDocument({ file, caseId });
        }}
      />
    </>
  );
}

function CaseDocumentList({ caseId }: { caseId: string }) {
  const { t } = useTranslation("case-portfolio");
  const { data: documents, isLoading, isError } = useCaseDocumentsQuery(caseId);
  const { mutate: deleteDocument, isPending: isDeleting, variables: deletingVars } = useDeleteCaseDocumentMutation();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("detail.loading")}</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{t("detail.loadDocumentsError")}</p>;
  }

  if (!documents || documents.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("detail.noDocuments")}</p>;
  }

  return (
    <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          {doc.fileUrl ? (
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-brand-gold hover:underline"
            >
              {doc.name}
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{doc.name}</span>
          )}
          <RagStatusBadge status={doc.ragStatus} />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={isDeleting && deletingVars?.documentId === doc.id}
                onClick={() => deleteDocument({ documentId: doc.id, caseId })}
                aria-label={t("detail.removeDocument", { documentName: doc.name })}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {isDeleting && deletingVars?.documentId === doc.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("detail.removeDocument", { documentName: doc.name })}</TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

/** A case tool entry — pass `onClick` once the tool behind it exists. Without one, this stays
 * a styled, inert placeholder (dimmed, no hover/click affordance) so it still reads as a real
 * menu item without misleadingly inviting a click that does nothing. */
function CaseToolRow({ icon: Icon, label, onClick }: { icon: typeof Network; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className="group flex items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors enabled:hover:bg-muted enabled:focus-visible:outline-none enabled:focus-visible:ring-2 enabled:focus-visible:ring-brand-gold/50 disabled:cursor-default disabled:opacity-50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{label}</span>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-enabled:group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}
