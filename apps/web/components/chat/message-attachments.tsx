"use client";

import { AlertCircle, Loader2, Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";

/** A Case Document shown as a chip on the message it was sent with — see
 * docs/adr/0012-message-scoped-document-attachments.md. `url` is a same-session blob URL
 * (see consultation-chat.tsx's handleSendMessage) until the backend ships a persisted
 * fileUrl (docs/message-attachments-backend-handoff.md §1); `null` renders a disabled chip. */
export interface MessageAttachment {
  id: string;
  name: string;
  url: string | null;
  mimeType: string | null;
}

/** ilovelawyer-api doesn't persist `mimeType` on `Document` at upload time (both `create` and
 * `createMany` write the row without it, even though the column exists and presign() already
 * receives the browser's `contentType`) — so it's `null` on every attachment fetched from the
 * backend, though same-session sends still have it from the browser's `File.type` (see
 * handleSendMessage). Falls back to the filename extension either way, mirroring the same
 * fallback ilovelawyer-api's own `extractText()` already uses for the same reason. */
export function isPdfAttachment(attachment: Pick<MessageAttachment, "mimeType" | "name">): boolean {
  return attachment.mimeType === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf");
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];

/** Same mimeType-then-extension fallback as isPdfAttachment, for the other in-app-previewable
 * type — a plain <img>, no third-party viewer needed. */
export function isImageAttachment(attachment: Pick<MessageAttachment, "mimeType" | "name">): boolean {
  if (attachment.mimeType?.startsWith("image/")) return true;
  const lower = attachment.name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** mp3 evidence — played with the browser's native <audio> element (a plain src= load, so no
 * CORS requirement on the presigned URL, same as the <img>/<iframe> previews). */
export function isAudioAttachment(attachment: Pick<MessageAttachment, "mimeType" | "name">): boolean {
  if (attachment.mimeType?.startsWith("audio/")) return true;
  return attachment.name.toLowerCase().endsWith(".mp3");
}

/** mp4 evidence — native <video> element, same reasoning as isAudioAttachment. */
export function isVideoAttachment(attachment: Pick<MessageAttachment, "mimeType" | "name">): boolean {
  if (attachment.mimeType?.startsWith("video/")) return true;
  return attachment.name.toLowerCase().endsWith(".mp4");
}

/** .docx (OOXML) only — docx-preview parses the zipped XML format Word 2007+ writes, not the
 * legacy binary .doc (Word 97-2003) format, which is a proprietary OLE structure no JS library
 * in this app parses. A .doc falls through to the same Download fallback as xlsx/pptx/etc. */
export function isDocxAttachment(attachment: Pick<MessageAttachment, "mimeType" | "name">): boolean {
  if (attachment.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return true;
  return attachment.name.toLowerCase().endsWith(".docx");
}

/** .xlsx/.xlsm/.xlam (OOXML) only, same reasoning as isDocxAttachment — xlsx-preview's exceljs
 * backend reads the zipped XML format Excel 2007+ writes. .xlsm (macro-enabled) and .xlam
 * (add-in) are the same OOXML container as .xlsx, so they preview the same way. Legacy binary
 * .xls (Excel 97-2003) is a different, unsupported format and falls through to the same
 * Download fallback as .doc/.ppt/etc. */
const XLSX_FAMILY_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.ms-excel.addin.macroEnabled.12",
];
const XLSX_FAMILY_EXTENSIONS = [".xlsx", ".xlsm", ".xlam"];

export function isXlsxAttachment(attachment: Pick<MessageAttachment, "mimeType" | "name">): boolean {
  if (attachment.mimeType && XLSX_FAMILY_MIME_TYPES.includes(attachment.mimeType)) return true;
  const lower = attachment.name.toLowerCase();
  return XLSX_FAMILY_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Legacy binary .doc (Word 97-2003) — no client-side JS library parses its OLE structure (see
 * isDocxAttachment above), so this doesn't get a rich preview. Instead AttachmentPreview fetches
 * a plain-text extraction from GET /documents/:id/text-preview (backend reuses the same
 * word-extractor-based extraction the RAG indexing pipeline already runs) and renders that. */
export function isLegacyDocAttachment(attachment: Pick<MessageAttachment, "mimeType" | "name">): boolean {
  if (attachment.mimeType === "application/msword") return true;
  return attachment.name.toLowerCase().endsWith(".doc");
}

interface MessageAttachmentsProps {
  attachments: MessageAttachment[];
  onSelect: (attachment: MessageAttachment) => void;
  /** Indexing status per document id (see consultation-chat.tsx's ragStatusById). The AI only
   * reads READY documents — a PENDING one (audio/video transcribing, PDFs still indexing) is
   * invisible to it, so the chip and a hint below make that visible instead of leaving the user
   * to wonder why the reply says no files are attached. Omitted → no status UI. */
  ragStatusById?: Map<string, "PENDING" | "READY" | "FAILED" | undefined>;
}

export function MessageAttachments({ attachments, onSelect, ragStatusById }: MessageAttachmentsProps) {
  const { t } = useTranslation("homepage");
  const statusOf = (attachment: MessageAttachment) => ragStatusById?.get(attachment.id);
  const anyPending = attachments.some((a) => statusOf(a) === "PENDING");
  const anyFailed = attachments.some((a) => statusOf(a) === "FAILED");

  return (
    <div className="flex max-w-[80%] flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {attachments.map((attachment) => {
          const status = statusOf(attachment);
          return (
            <button
              key={attachment.id}
              type="button"
              onClick={() => onSelect(attachment)}
              disabled={!attachment.url}
              aria-label={t("attachment.viewFile", { fileName: attachment.name })}
              className="flex max-w-[240px] items-center gap-2 rounded-full border border-border bg-card px-3 py-[5px] text-left text-[12px] text-foreground/85 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-default disabled:opacity-60"
            >
              {status === "PENDING" ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-60" aria-hidden="true" />
              ) : status === "FAILED" ? (
                <AlertCircle className="h-3 w-3 shrink-0 text-red-500" aria-hidden="true" />
              ) : (
                <Paperclip className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
              )}
              <span className="truncate font-['Inter']">{attachment.name}</span>
            </button>
          );
        })}
      </div>
      {anyPending && (
        <p className="text-right font-['Inter'] text-[11px] leading-4 text-muted-foreground">{t("attachment.processingHint")}</p>
      )}
      {anyFailed && (
        <p className="text-right font-['Inter'] text-[11px] leading-4 text-red-500">{t("attachment.processingFailed")}</p>
      )}
    </div>
  );
}
