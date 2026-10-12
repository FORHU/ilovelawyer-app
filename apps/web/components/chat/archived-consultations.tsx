"use client";
import { useMemo, useState } from "react";
import { Archive, ArrowLeft, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useArchiveConsultationMutation,
  useConsultationsQuery,
  useDeleteConsultationMutation,
  useMessagesQuery,
  useUnarchiveConsultationMutation,
  type Consultation,
} from "@/lib/chat/mutations";
import { useCanContributeToCase } from "@/lib/cases/permissions";
import { formatRelativeTime } from "@/lib/notifications/format";
import { useAuthStore } from "@/lib/store/auth.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";
import AssistantMessage from "@/components/chat/assistant-message";
import { ConsultationConfirmModal } from "@/components/chat/consultation-confirm-modal";
import { visibleChatMessages } from "@/lib/chat/use-topic-navigator";

/** Archiving a consultation: `requestArchive` opens a confirmation (render `archiveDialog`
 * wherever the list is), and once confirmed the toast still carries an Undo. `onArchived` runs
 * once it's out of the list, e.g. to move off it when it was the one open. */
export function useArchiveConsultation() {
  const { t } = useTranslation("homepage");
  const archive = useArchiveConsultationMutation();
  const unarchive = useUnarchiveConsultationMutation();
  const [target, setTarget] = useState<{ id: string; name: string; onArchived?: () => void } | null>(null);

  const requestArchive = (id: string, name: string, { onArchived }: { onArchived?: () => void } = {}) =>
    setTarget({ id, name, onArchived });

  const confirm = () => {
    if (!target) return;
    const { id, onArchived } = target;
    archive.mutate(id, {
      onSuccess: () => {
        setTarget(null);
        onArchived?.();
        toast.success(t("sidebar.consultationArchived"), {
          action: {
            label: t("sidebar.undo"),
            onClick: () => unarchive.mutate(id, { onError: () => toast.error(t("sidebar.restoreConsultationFailed")) }),
          },
        });
      },
      // The dialog stays open, so trying again is one click.
      onError: (error) =>
        toast.error(
          (error as { code?: string }).code === "REPLY_GENERATING"
            ? t("sidebar.archiveWhileGenerating")
            : t("sidebar.archiveConsultationFailed"),
        ),
    });
  };

  const archiveDialog = target ? (
    <ConsultationConfirmModal
      action="archive"
      name={target.name}
      isPending={archive.isPending}
      onConfirm={confirm}
      onClose={() => setTarget(null)}
    />
  ) : null;

  return { requestArchive, archiveDialog, archivingId: archive.isPending ? archive.variables : null };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The archive's entry point, pinned under a consultation list (Case Workspace's — pass `caseId`
 * — or /homepage's standalone one): one button with a count that opens ArchivedConsultationsModal.
 * Nothing archived is listed in the panel itself. */
export function ArchivedConsultationsButton({ caseId, onRestored }: { caseId?: string; onRestored?: (id: string) => void }) {
  const { t } = useTranslation("homepage");
  const [open, setOpen] = useState(false);
  const { data: archived } = useConsultationsQuery(caseId, { status: "ARCHIVED" });
  const count = archived?.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-overlay-hover"
      >
        <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left uppercase tracking-[0.06em] text-[11px]">{t("sidebar.archived")}</span>
        {count > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground dark:bg-overlay-hover">
            {count}
          </span>
        )}
      </button>
      {open && (
        <ArchivedConsultationsModal
          caseId={caseId}
          onClose={() => setOpen(false)}
          onRestored={(id) => {
            setOpen(false);
            onRestored?.(id);
          }}
        />
      )}
    </>
  );
}

/** Where archived consultations are managed: the list on one side, a read-only preview of the
 * selected one on the other (stacked on narrow screens, with a back button), and its Restore /
 * Delete actions. Restoring closes this and opens the consultation. Deleting schedules it 30 days
 * out — it stays here with a countdown until then, and restoring cancels it. */
function ArchivedConsultationsModal({
  caseId,
  onClose,
  onRestored,
}: {
  caseId?: string;
  onClose: () => void;
  onRestored: (id: string) => void;
}) {
  const { t } = useTranslation("homepage");
  const { data: archived, isLoading, isError, refetch } = useConsultationsQuery(caseId, { status: "ARCHIVED" });
  const myUserId = useAuthStore((s) => s.user?.id);
  // Read-only for a view-only person on a confidential case: no restore or delete, their own included.
  const readOnly = !useCanContributeToCase(caseId);
  const unarchive = useUnarchiveConsultationMutation();
  const remove = useDeleteConsultationMutation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Consultation | null>(null);

  // Desktop opens on the newest one so the preview is never blank; on a phone the list comes
  // first (see `showPreviewOnMobile`), so this default doesn't skip it.
  const selected = archived?.find((c) => c.id === selectedId) ?? archived?.[0] ?? null;
  const [showPreviewOnMobile, setShowPreviewOnMobile] = useState(false);

  const titleOf = (c: Consultation) => c.title?.trim() || t("sidebar.untitledConsultation");

  const handleRestore = (c: Consultation) => {
    unarchive.mutate(c.id, {
      onSuccess: () => onRestored(c.id),
      onError: () => toast.error(t("sidebar.restoreConsultationFailed")),
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success(t("sidebar.consultationDeletionScheduled"));
      },
      onError: () => toast.error(t("sidebar.deleteConsultationFailed")),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !deleting && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(85vh,760px)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/60 px-5 py-4">
          <div className="min-w-0">
            <DialogTitle asChild>
              <h2 className="font-['Libre_Caslon_Text'] text-lg font-normal text-foreground">{t("sidebar.archivedConsultationsTitle")}</h2>
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">{t("sidebar.archivedConsultationsHint")}</DialogDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("sidebar.closeDialog")}
                className="-m-1 shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-overlay-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("sidebar.closeDialog")}</TooltipContent>
          </Tooltip>
        </div>

        {isLoading ? (
          <p className="p-6 text-[13px] text-muted-foreground">{t("sidebar.loadingConsultations")}</p>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center" role="alert">
            <p className="text-[13px] text-muted-foreground">{t("sidebar.archivedLoadFailed")}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {t("historyLoadRetry")}
            </button>
          </div>
        ) : !archived || archived.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <Archive className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-[13px] text-muted-foreground">{t("sidebar.noArchivedConsultations")}</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* List — always on desktop; on a phone only until one is picked. */}
            <ul
              className={`min-h-0 w-full shrink-0 overflow-y-auto border-border p-2 md:block md:w-72 md:border-r ${
                showPreviewOnMobile ? "hidden" : "block"
              }`}
            >
              {archived.map((c) => {
                const isSelected = c.id === selected?.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        setShowPreviewOnMobile(true);
                      }}
                      aria-current={isSelected ? "true" : undefined}
                      className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        isSelected ? "md:bg-muted md:dark:bg-overlay-hover" : "hover:bg-muted/60 dark:hover:bg-overlay-hover"
                      }`}
                    >
                      <span className={`truncate text-[13px] ${isSelected ? "md:font-semibold" : ""} text-foreground`}>{titleOf(c)}</span>
                      <ArchivedMeta consultation={c} />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Preview — beside the list on desktop; replaces it on a phone. */}
            {selected && (
              <section
                aria-label={t("sidebar.previewOf", { name: titleOf(selected) })}
                className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${showPreviewOnMobile ? "flex" : "hidden"}`}
              >
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setShowPreviewOnMobile(false)}
                    aria-label={t("sidebar.backToArchived")}
                    className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">{titleOf(selected)}</p>
                    <ArchivedMeta consultation={selected} />
                  </div>
                  {/* Same rule as the list's Archive: offered on your own; the API also lets case
                      editors act on a colleague's (see ChatSvc.assertCanRemove). */}
                  {selected.userId === myUserId && !readOnly && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestore(selected)}
                        disabled={unarchive.isPending}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 dark:hover:bg-overlay-hover"
                      >
                        {unarchive.isPending && unarchive.variables === selected.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {selected.deletionScheduledFor ? t("sidebar.restoreCancelDeletion") : t("sidebar.restore")}
                      </button>
                      {/* Already counting down — restoring is the only thing left to do. */}
                      {!selected.deletionScheduledFor && (
                        <button
                          type="button"
                          onClick={() => setDeleting(selected)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("sidebar.deleteConsultation")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <ArchivedTranscript consultationId={selected.id} />
              </section>
            )}
          </div>
        )}

        {deleting && (
          <ConsultationConfirmModal
            action="delete"
            name={titleOf(deleting)}
            isPending={remove.isPending}
            onConfirm={confirmDelete}
            onClose={() => setDeleting(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "Archived 2h ago", or the red deletion countdown once one is scheduled. */
function ArchivedMeta({ consultation }: { consultation: Consultation }) {
  const { t } = useTranslation("homepage");
  return consultation.deletionScheduledFor ? (
    <span className="truncate text-[11px] text-red-500 dark:text-red-400">
      {t("sidebar.deletesInDays", { count: daysUntil(consultation.deletionScheduledFor) })}
    </span>
  ) : (
    <span className="truncate text-[11px] text-muted-foreground">
      {t("sidebar.archivedAgo", { when: formatRelativeTime(consultation.archivedAt ?? consultation.createdAt) })}
    </span>
  );
}

/** The archived consultation's conversation, read-only — the same bubbles as the chat, without
 * the composer or any of the live tooling around them. */
function ArchivedTranscript({ consultationId }: { consultationId: string }) {
  const { t } = useTranslation("homepage");
  const { data: history, isLoading, isError, refetch } = useMessagesQuery(consultationId);
  const messages = useMemo(() => visibleChatMessages(history), [history]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin [scrollbar-color:var(--border)_transparent]">
      {isLoading ? (
        <p className="text-[13px] text-muted-foreground">{t("sidebar.loadingPreview")}</p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="text-[13px] text-muted-foreground">{t("historyLoadError")}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("historyLoadRetry")}
          </button>
        </div>
      ) : messages.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t("sidebar.previewEmpty")}</p>
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={m.id ?? i} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-[18px_18px_4px_18px] border border-border bg-muted px-3 py-2 font-['Inter'] text-[13px] leading-5 text-foreground">
                  {m.content}
                </div>
              </div>
            ) : (
              <AssistantMessage key={m.id ?? i} content={m.content} className="text-foreground" />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Whole days left before a scheduled deletion takes effect — 0 once it's due (the hourly purge
 * may not have run yet). */
function daysUntil(isoDate: string): number {
  return Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / DAY_MS));
}
