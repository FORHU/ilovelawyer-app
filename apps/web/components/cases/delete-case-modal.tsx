"use client";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CaseRecord } from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

interface DeleteCaseModalProps {
  caseRecord: CaseRecord;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteCaseModal({ caseRecord, isDeleting, onConfirm, onClose }: DeleteCaseModalProps) {
  const { t } = useTranslation("case-portfolio");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
              {t("Delete Case")}
            </h2>
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label={t("Close")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("Close")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="px-6 py-6 flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <DialogDescription asChild>
            <p className="text-sm text-foreground leading-relaxed">
              {t("deleteConfirm", { caseName: caseRecord.caseName })}
            </p>
          </DialogDescription>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("Cancel")}
              </button>
            </TooltipTrigger>
            <TooltipContent>Keep this case and close without deleting</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 bg-red-600 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-red-700 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {isDeleting ? t("Deleting…") : t("Delete Case")}
              </button>
            </TooltipTrigger>
            <TooltipContent>Permanently delete {caseRecord.caseName} and its records</TooltipContent>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
  );
}
