"use client";
import { Archive, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

interface BulkArchiveCasesModalProps {
  count: number;
  isArchiving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirms a multi-case archive (Select All / bulk selection on the Active Cases tab of Case
 * Portfolio) — same chrome as ArchiveCaseModal, generalized to a count instead of a single case
 * name, mirroring BulkRestoreCasesModal in reverse. Archiving a case also archives its documents
 * (see CaseSvc.archive's existing cascade), so the confirm copy mentions both. */
export default function BulkArchiveCasesModal({ count, isArchiving, onConfirm, onClose }: BulkArchiveCasesModalProps) {
  const { t } = useTranslation("case-portfolio");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
              {t("archiveCasesCta", { count })}
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Archive className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <DialogDescription asChild>
            <p className="text-sm text-foreground leading-relaxed">{t("archiveCasesConfirm", { count })}</p>
          </DialogDescription>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                disabled={isArchiving}
                className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("editModal.cancel")}
              </button>
            </TooltipTrigger>
            <TooltipContent>Keep these cases active and close without archiving</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isArchiving}
                className="inline-flex items-center gap-2 bg-brand-navy-900 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isArchiving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {isArchiving ? t("archiving") : t("archiveCasesCta", { count })}
              </button>
            </TooltipTrigger>
            <TooltipContent>Move {count} case{count === 1 ? "" : "s"} to the Archived tab, archiving their documents too</TooltipContent>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
  );
}
