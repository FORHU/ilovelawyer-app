"use client";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

interface SwitchOffAiModalProps {
  isPending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Shown before AI processing is switched off, so nobody loses the AI features by accident. */
export default function SwitchOffAiModal({ isPending, error, onConfirm, onClose }: SwitchOffAiModalProps) {
  const { t } = useTranslation("profile");

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
              {t("yourData.aiProcessing.confirmTitle")}
            </h2>
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={t("yourData.aiProcessing.closeModal")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("yourData.aiProcessing.closeModal")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="px-6 py-6 flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-3">
              <DialogDescription asChild>
                <p className="text-sm text-foreground leading-relaxed">{t("yourData.aiProcessing.confirmDescription")}</p>
              </DialogDescription>
              <ul className="list-disc pl-5 text-sm text-foreground leading-relaxed">
                <li>{t("yourData.aiProcessing.confirmChat")}</li>
                <li>{t("yourData.aiProcessing.confirmCase")}</li>
                <li>{t("yourData.aiProcessing.confirmUpload")}</li>
              </ul>
              <p className="text-[13px] text-muted-foreground">{t("yourData.aiProcessing.confirmUndo")}</p>
            </div>
          </div>
          {error && <p className="text-[13px] text-red-600 dark:text-red-400" role="alert">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            autoFocus
            className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("yourData.aiProcessing.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-red-600 text-white text-xs font-semibold tracking-wider uppercase px-6 py-2.5 rounded-full hover:bg-red-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {isPending ? t("yourData.aiProcessing.switchingOff") : t("yourData.aiProcessing.confirmButton")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
