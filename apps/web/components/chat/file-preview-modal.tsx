"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, X, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { AttachmentPreview, isZoomableAttachment } from "@/components/chat/attachment-preview";
import type { MessageAttachment } from "@/components/chat/message-attachments";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const ICON_BUTTON =
  "rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-40";

interface FilePreviewModalProps {
  attachment: MessageAttachment;
  onClose: () => void;
  /** z-index class for the backdrop. Defaults to the global modal layer; the Terminal passes
   * z-(--z-canvas-overlay) so the viewer clears a maximized pane (z-[90]) and Free-canvas panes. */
  layerClassName?: string;
  /** Open a PDF at this page and highlight this passage on it (see AttachmentPreview). */
  page?: number | null;
  quote?: string | null;
  /** Shown beside the file name, e.g. where in a merged bundle the cited passage is. */
  subtitle?: string | null;
}

/** Modal chrome (backdrop, title bar, Escape-to-close) around AttachmentPreview — used for the
 * chat attachment-chip preview. Studio's inline Documents preview (DocumentFolderBrowser) embeds
 * AttachmentPreview directly instead, with its own back-navigation header, since a full-viewport
 * overlay doesn't make sense inside a docked sidebar. */
export default function FilePreviewModal({ attachment, onClose, layerClassName = "z-(--z-modal)", page, quote, subtitle }: FilePreviewModalProps) {
  const { t } = useTranslation("homepage");
  const [zoom, setZoom] = useState(1);
  const zoomable = isZoomableAttachment(attachment);
  const zoomBy = (delta: number) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));

  useEffect(() => {
    // Capture phase + stopPropagation: this is the topmost layer, so Escape is ours. Otherwise
    // focus is often still on the trigger inside an underlying overlay (e.g. a maximized
    // Terminal pane), whose own Escape handler would close *it* and leave this preview open.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 ${layerClassName} flex items-center justify-center bg-black/50 sm:px-4 sm:py-8`}
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-card shadow-2xl sm:h-[80vh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-border"
        role="dialog"
        aria-modal="true"
        aria-label={attachment.name}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate text-sm font-medium text-foreground">{attachment.name}</span>
            {subtitle ? <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">· {subtitle}</span> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {zoomable && (
              <>
                <button type="button" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} className={ICON_BUTTON} aria-label={t("attachment.zoomOut")}>
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="min-w-10 rounded-full px-1 py-2 text-xs tabular-nums text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label={t("attachment.resetZoom")}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} className={ICON_BUTTON} aria-label={t("attachment.zoomIn")}>
                  <ZoomIn className="h-4 w-4" />
                </button>
              </>
            )}
            {attachment.url && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a href={attachment.url} download={attachment.name} className={ICON_BUTTON} aria-label={t("attachment.download")}>
                      <Download className="h-4 w-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className={layerClassName}>{t("attachment.download")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className={ICON_BUTTON} aria-label={t("attachment.openInNewTab")}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className={layerClassName}>{t("attachment.openInNewTab")}</TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={onClose} className={ICON_BUTTON} aria-label={t("attachment.closePreview")}>
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className={layerClassName}>{t("attachment.closePreview")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <AttachmentPreview attachment={attachment} page={page} quote={quote} zoom={zoom} />
        </div>
      </div>
    </div>
  );
}
