"use client";
import { AlertTriangle, CalendarClock, Loader2, LogOut, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

interface DeleteAccountModalProps {
  isPending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  /** Set once the deletion request has succeeded — swaps the dialog into a logout-only
   * confirmation screen showing when the account will actually be deleted. */
  scheduledFor?: string | null;
  isLoggingOut?: boolean;
  onLogout?: () => void;
}

export default function DeleteAccountModal({
  isPending,
  error,
  onConfirm,
  onClose,
  scheduledFor,
  isLoggingOut,
  onLogout,
}: DeleteAccountModalProps) {
  const { t } = useTranslation("profile");

  if (scheduledFor) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent role="alertdialog" showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <div className="px-6 py-5 border-b border-border bg-muted/60">
            <DialogTitle asChild>
              <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
                {t("dangerZone.deleteAccount.successTitle")}
              </h2>
            </DialogTitle>
          </div>

          <div className="px-6 py-6 flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              <CalendarClock className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <DialogDescription asChild>
              <p className="text-sm text-foreground leading-relaxed">
                {t("dangerZone.deleteAccount.successDescription", { date: scheduledFor })}
              </p>
            </DialogDescription>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={isLoggingOut}
                  className="inline-flex items-center gap-2 bg-brand-navy-900 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoggingOut ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {t("dangerZone.deleteAccount.successLogoutButton")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Sign out of this device</TooltipContent>
            </Tooltip>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
              {t("dangerZone.deleteAccount.confirmTitle")}
            </h2>
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label={t("dangerZone.closeModal")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("dangerZone.closeModal")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="px-6 py-6 flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <DialogDescription asChild>
            <p className="text-sm text-foreground leading-relaxed">
              {t("dangerZone.deleteAccount.confirmDescription")}
            </p>
          </DialogDescription>
        </div>

        {error && (
          <div className="px-6 pb-4 -mt-2">
            <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("dangerZone.cancel")}
              </button>
            </TooltipTrigger>
            <TooltipContent>Keep your account and close this dialog</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className="inline-flex items-center gap-2 bg-red-600 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-red-700 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {isPending ? t("dangerZone.deleteAccount.deleting") : t("dangerZone.deleteAccount.confirmButton")}
              </button>
            </TooltipTrigger>
            <TooltipContent>Permanently delete your account and all data</TooltipContent>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
  );
}
