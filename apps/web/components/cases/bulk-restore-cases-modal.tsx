"use client";
import { ArchiveRestore, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

interface BulkRestoreCasesModalProps {
  count: number;
  isRestoring: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirms a multi-case restore (Select All / bulk selection on the Archived Cases tab of Case
 * Portfolio) — same chrome as ArchiveCaseModal, generalized to a count instead of a single case
 * name, and restore-themed like BulkRestoreDocumentsModal. Restoring a case also restores its
 * documents (see CaseSvc.unarchive's cascade), so the confirm copy mentions both. */
export default function BulkRestoreCasesModal({ count, isRestoring, onConfirm, onClose }: BulkRestoreCasesModalProps) {
  const { t } = useTranslation("case-portfolio");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
              {t("restoreCasesCta", { count })}
            </h2>
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label={t("editModal.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("editModal.close")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="px-6 py-6 flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
            <ArchiveRestore className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <DialogDescription asChild>
            <p className="text-sm text-foreground leading-relaxed">{t("restoreCasesConfirm", { count })}</p>
          </DialogDescription>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                disabled={isRestoring}
                className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("editModal.cancel")}
              </button>
            </TooltipTrigger>
            <TooltipContent>Keep these cases archived and close without restoring them</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isRestoring}
                className="inline-flex items-center gap-2 bg-brand-navy-900 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRestoring && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {isRestoring ? t("restoring") : t("restoreCasesCta", { count })}
              </button>
            </TooltipTrigger>
            <TooltipContent>Move {count} case{count === 1 ? "" : "s"} back to the Active tab, restoring their documents too</TooltipContent>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
  );
}
