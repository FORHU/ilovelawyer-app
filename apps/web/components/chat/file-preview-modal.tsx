"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { isPdfAttachment, type MessageAttachment } from "@/components/chat/message-attachments";

interface FilePreviewModalProps {
  attachment: MessageAttachment;
  onClose: () => void;
}

/** In-app preview for a Message Attachment (ADR 0012). PDFs render inline via the browser's
 * native viewer; DOCX (and any PDF that fails to render) falls back to filename + "open in a
 * new tab" instead — deliberately not a third-party embed viewer (Office/Google), which would
 * send a potentially confidential document's URL to that third party. */
export default function FilePreviewModal({ attachment, onClose }: FilePreviewModalProps) {
  const { t } = useTranslation("homepage");
  const [inlineFailed, setInlineFailed] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isPdf = isPdfAttachment(attachment);
  const canInlinePreview = isPdf && !!attachment.url && !inlineFailed;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={attachment.name}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate text-sm font-medium text-foreground">{attachment.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {attachment.url && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label={t("attachment.openInNewTab")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>{t("attachment.openInNewTab")}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label={t("attachment.closePreview")}
                >
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("attachment.closePreview")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-muted/30">
          {canInlinePreview ? (
            <iframe
              src={attachment.url!}
              title={attachment.name}
              className="h-full w-full border-0"
              onError={() => setInlineFailed(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {t(isPdf ? "attachment.previewFailed" : "attachment.previewUnavailable")}
              </p>
              {attachment.url && (
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy-950 hover:underline dark:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("attachment.openInNewTab")}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
