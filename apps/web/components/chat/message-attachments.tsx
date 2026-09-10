"use client";

import { Paperclip } from "lucide-react";
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
          className="flex max-w-[240px] items-center gap-2 rounded-full border border-white/15 bg-card px-3 py-[5px] text-left text-[12px] text-white/85 transition-colors hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-default disabled:opacity-60"
        >
          <Paperclip className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          <span className="truncate font-['Inter']">{attachment.name}</span>
        </button>
      ))}
    </div>
  );
}
