"use client";

import { FileText } from "lucide-react";
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

function fileTypeLabel(attachment: Pick<MessageAttachment, "mimeType" | "name">): string {
  if (attachment.mimeType === "application/pdf") return "PDF";
  if (attachment.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "DOCX";
  if (attachment.mimeType === "application/msword") return "DOC";
  const ext = attachment.name.split(".").pop();
  return ext ? ext.toUpperCase() : "FILE";
}

interface MessageAttachmentsProps {
  attachments: MessageAttachment[];
  onSelect: (attachment: MessageAttachment) => void;
}

export function MessageAttachments({ attachments, onSelect }: MessageAttachmentsProps) {
  const { t } = useTranslation("homepage");

  return (
    <div className="flex flex-wrap justify-end gap-2 max-w-[80%]">
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          onClick={() => onSelect(attachment)}
          disabled={!attachment.url}
          aria-label={t("attachment.viewFile", { fileName: attachment.name })}
          className="flex w-full max-w-[220px] items-center gap-2.5 rounded-2xl border border-border bg-muted px-3 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-muted disabled:hover:border-border"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            <FileText className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-['Inter'] text-[13px] font-medium text-foreground">{attachment.name}</span>
            <span className="font-['Inter'] text-[11px] text-muted-foreground">{fileTypeLabel(attachment)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
