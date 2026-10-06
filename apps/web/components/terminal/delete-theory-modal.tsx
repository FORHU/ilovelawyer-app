"use client";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";
import { MutationError } from "@/components/terminal/panel-kit";

interface DeleteTheoryModalProps {
  theory: { title: string; isFork: boolean };
  isDeleting: boolean;
  isError: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteTheoryModal({ theory, isDeleting, isError, onConfirm, onClose }: DeleteTheoryModalProps) {
  const { t } = useTranslation("terminal");

  return (
    // Closing is blocked mid-delete so the request can't be orphaned behind a dismissed modal.
    <Dialog open onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
              {t("deleteTheoryTitle")}
            </h2>
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t("close")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("close")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="px-6 py-6 flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground wrap-break-word">{theory.title}</p>
            <DialogDescription asChild>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {t(theory.isFork ? "deleteForkedTheoryConfirm" : "deleteTheoryConfirm")}
              </p>
            </DialogDescription>
            <MutationError show={isError} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 bg-destructive text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-destructive/90 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {t("delete")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
