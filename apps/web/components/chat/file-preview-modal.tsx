"use client";

import { useEffect } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { AttachmentPreview } from "@/components/chat/attachment-preview";
import type { MessageAttachment } from "@/components/chat/message-attachments";

interface FilePreviewModalProps {
  attachment: MessageAttachment;
  onClose: () => void;
}

/** Modal chrome (backdrop, title bar, Escape-to-close) around AttachmentPreview — used for the
 * chat attachment-chip preview. Studio's inline Documents preview (DocumentFolderBrowser) embeds
 * AttachmentPreview directly instead, with its own back-navigation header, since a full-viewport
 * overlay doesn't make sense inside a docked sidebar. */
export default function FilePreviewModal({ attachment, onClose }: FilePreviewModalProps) {
  const { t } = useTranslation("homepage");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-black/50 px-4 py-8"
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
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label={t("attachment.closePreview")}
                >
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("attachment.closePreview")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <AttachmentPreview attachment={attachment} />
        </div>
      </div>
    </div>
  );
}
