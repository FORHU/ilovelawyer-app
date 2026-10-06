"use client";
import { AlertTriangle, Archive, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

interface ConsultationConfirmModalProps {
  /** "archive" — the reversible soft delete; "delete" — permanent, offered from the archive only. */
  action: "archive" | "delete";
  /** The consultation's display title. */
  name: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation before archiving or permanently deleting a consultation — same layout as
 * ArchiveCaseModal/DeleteCaseModal, so it reads as the app's own warning rather than the
 * browser's. Can't be dismissed while the request is in flight. */
export function ConsultationConfirmModal({ action, name, isPending, onConfirm, onClose }: ConsultationConfirmModalProps) {
  const { t } = useTranslation("homepage");
  const isDelete = action === "delete";
  const close = () => {
    if (!isPending) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
              {isDelete ? t("sidebar.deleteConsultationTitle") : t("sidebar.archiveConsultationTitle")}
            </h2>
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={close}
                disabled={isPending}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"
                aria-label={t("sidebar.closeDialog")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("sidebar.closeDialog")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="px-6 py-6 flex gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              isDelete
                ? "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                : "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
            }`}
          >
            {isDelete ? <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" /> : <Archive className="h-4.5 w-4.5" aria-hidden="true" />}
          </div>
          <DialogDescription asChild>
            <p className="text-sm text-foreground leading-relaxed">
              {isDelete ? t("sidebar.deleteConsultationConfirm", { name }) : t("sidebar.archiveConsultationConfirm", { name })}
            </p>
          </DialogDescription>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <button
            type="button"
            onClick={close}
            disabled={isPending}
            className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("sidebar.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`inline-flex items-center gap-2 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
              isDelete
                ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-600/40"
                : "bg-brand-navy-900 hover:bg-brand-navy-800 focus-visible:ring-brand-navy-900/40"
            }`}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {isDelete
              ? isPending
                ? t("sidebar.deleting")
                : t("sidebar.deleteConsultation")
              : isPending
                ? t("sidebar.archiving")
                : t("sidebar.archiveConsultation")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
