"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "@/lib/chat/mutations";
import { stripStructuredBlocks } from "@/lib/chat/mind-map-parser";
import { useCaseDocumentsQuery } from "@/lib/cases/mutations";
import { useSendEmailMutation } from "@/lib/email/mutations";

interface EmailComposerModalProps {
  consultationId: string;
  caseId?: string;
  /** The consultation's full message history (from `useMessagesQuery`) — not the display-only
   * `DisplayMessage[]` shape, since this needs message-level `documents` regardless of whether
   * `enableFileChips` is on for this page (ADR 0012 gates chip *display*, not email content). */
  messages: ChatMessage[];
  onClose: () => void;
}

interface AttachableDocument {
  id: string;
  name: string;
}

/** In-app email composer (docs/adr/0013-case-consultation-email-action.md). Pre-fills the body
 * from the consultation's most recent AI response and offers every document reachable from this
 * consultation — Case Documents (when scoped to a case) plus any documents attached to individual
 * messages — as attachments. Sending isn't live yet; see
 * docs/case-consultation-email-backend-handoff.md for the endpoint this is waiting on. */
export default function EmailComposerModal({ consultationId, caseId, messages, onClose }: EmailComposerModalProps) {
  const { t } = useTranslation("homepage");
  const { data: caseDocuments } = useCaseDocumentsQuery(caseId ?? "");
  const sendEmail = useSendEmailMutation();

  const assistantMessages = useMemo(
    () => messages.filter((m) => m.role === "assistant" && m.content.trim().length > 0).reverse(),
    [messages],
  );

  const [sourceMessageId, setSourceMessageId] = useState<string | undefined>(assistantMessages[0]?.id);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(() =>
    assistantMessages[0] ? stripStructuredBlocks(assistantMessages[0].content) : "",
  );
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSourceMessageChange = (id: string) => {
    setSourceMessageId(id);
    const source = assistantMessages.find((m) => m.id === id);
    if (source) setBody(stripStructuredBlocks(source.content));
  };

  // Merges Case Documents (only present when this consultation is scoped to a case) with
  // whatever documents are attached to individual messages in this consultation — the only
  // source available for a standalone (caseless) consultation — deduped by id.
  const availableDocuments = useMemo(() => {
    const byId = new Map<string, AttachableDocument>();
    for (const doc of caseDocuments ?? []) byId.set(doc.id, { id: doc.id, name: doc.name });
    for (const message of messages) {
      for (const doc of message.documents ?? []) byId.set(doc.id, { id: doc.id, name: doc.name });
    }
    return Array.from(byId.values());
  }, [caseDocuments, messages]);

  const toggleDocument = (id: string) => {
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendEmail.mutate({
      consultationId,
      to,
      subject,
      text: body,
      documentIds: Array.from(selectedDocumentIds),
    });
  };

  const canSubmit = to.trim().length > 0 && subject.trim().length > 0 && body.trim().length > 0 && !sendEmail.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("email.composerTitle")}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">{t("email.composerTitle")}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={t("email.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">{t("email.to")}</span>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={t("email.toPlaceholder")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">{t("email.subject")}</span>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("email.subjectPlaceholder")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </label>

          {assistantMessages.length > 0 && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">{t("email.sourceMessageLabel")}</span>
              <select
                value={sourceMessageId}
                onChange={(e) => handleSourceMessageChange(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {assistantMessages.map((m, i) => (
                  <option key={m.id} value={m.id}>
                    {t("email.sourceMessageOption", { index: assistantMessages.length - i })}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">{t("email.body")}</span>
            <textarea
              required
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </label>

          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">{t("email.attachmentsLabel")}</span>
            {availableDocuments.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("email.noAttachments")}</p>
            ) : (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
                {availableDocuments.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.has(doc.id)}
                      onChange={() => toggleDocument(doc.id)}
                      className="h-4 w-4 shrink-0 rounded border-border"
                    />
                    <span className="truncate">{doc.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {sendEmail.isError && <p className="text-xs text-red-600 dark:text-red-400">{t("email.notAvailable")}</p>}
          {sendEmail.isSuccess && <p className="text-xs text-green-600 dark:text-green-400">{t("email.sendSuccess")}</p>}

          <div className="mt-1 flex shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t("email.cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full bg-brand-navy-950 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#162244] disabled:opacity-50"
            >
              {sendEmail.isPending ? t("email.sending") : t("email.send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
