"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronDown, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import type { UserDocument } from "@/lib/cases/mutations";
import { RagStatusBadge } from "@/components/cases/rag-status-badge";

interface SourceViewerProps {
  document: UserDocument;
  onBack: () => void;
}

function formatFileSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionLabel(name: string, mimeType: string | null | undefined): string {
  const ext = name.split(".").pop();
  if (ext && ext !== name) return ext.toUpperCase();
  return mimeType?.split("/").pop()?.toUpperCase() ?? "FILE";
}

/** Case Workspace Sources panel's in-place document reader (NotebookLM-style "open a
 * source"), swapped in over the documents list by sources-panel.tsx rather than navigating
 * or opening a new tab. Renders the original file directly (PDF via the browser's native
 * viewer, images inline) instead of a reconstructed text stream — there's no backend endpoint
 * yet that reassembles a document's RAG chunks (document-chunk.repository.ts) back into
 * ordered full text, so that's a follow-up, not something to fake here. */
export function SourceViewer({ document: doc, onBack }: SourceViewerProps) {
  const { t } = useTranslation("case-portfolio");
  const [guideOpen, setGuideOpen] = useState(true);

  const isPdf = doc.mimeType === "application/pdf" || doc.name.toLowerCase().endsWith(".pdf");
  const isImage = doc.mimeType?.startsWith("image/") ?? false;
  const sizeLabel = formatFileSize(doc.fileSize);
  const uploadedLabel = new Date(doc.createdAt).toLocaleDateString();
  const summary = doc.aiSummary?.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("workspace.sourceViewerBack")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {isImage ? (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="truncate text-[13px] font-semibold text-foreground">{doc.name}</span>
        </div>
        <RagStatusBadge status={doc.ragStatus} />
        {doc.fileUrl && (
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("workspace.sourceOpenOriginal")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>

      <div className="shrink-0 border-b border-border">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          aria-expanded={guideOpen}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("Source Guide")}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${guideOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {guideOpen && (
          <div className="flex flex-col gap-3 px-3 pb-3 text-[13px]">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <dt className="text-muted-foreground">{t("Document Type")}</dt>
              <dd className="text-foreground">{extensionLabel(doc.name, doc.mimeType)}</dd>
              {sizeLabel && (
                <>
                  <dt className="text-muted-foreground">{t("Document Size")}</dt>
                  <dd className="text-foreground">{sizeLabel}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t("Uploaded")}</dt>
              <dd className="text-foreground">{uploadedLabel}</dd>
            </dl>
            <div>
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 bg-muted/40">
        {doc.fileUrl && isPdf ? (
          <iframe src={doc.fileUrl} title={doc.name} className="h-full w-full border-0" />
        ) : doc.fileUrl && isImage ? (
          <div className="flex h-full items-center justify-center overflow-auto p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary S3 URL, not a static/optimizable asset */}
            <img src={doc.fileUrl} alt={doc.name} className="max-w-full rounded-lg border border-border" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-xs text-sm text-muted-foreground">{t("workspace.sourcePreviewUnavailable")}</p>
            {doc.fileUrl && (
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                {t("workspace.sourceOpenOriginal")}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
