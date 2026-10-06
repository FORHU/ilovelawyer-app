"use client";
import { useState } from "react";
import { AlertTriangle, CalendarClock, Eye, EyeOff, Loader2, LogOut, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

interface DeleteAccountModalProps {
  isPending: boolean;
  error?: string | null;
  /** Password accounts must re-enter their password before the deletion is scheduled; Google SSO
   * accounts have none, so they confirm without one. */
  requiresPassword: boolean;
  onConfirm: (password?: string) => void;
  onClose: () => void;
  /** Set once the deletion request has succeeded — swaps the dialog into a logout-only
   * confirmation screen showing when the account will actually be deleted. The API has already
   * revoked every session by then (signing back in is what cancels the deletion), so logging
   * out here only clears this browser's state. */
  scheduledFor?: string | null;
  isLoggingOut?: boolean;
  onLogout?: () => void;
}

export default function DeleteAccountModal({
  isPending,
  error,
  requiresPassword,
  onConfirm,
  onClose,
  scheduledFor,
  isLoggingOut,
  onLogout,
}: DeleteAccountModalProps) {
  const { t } = useTranslation("profile");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canConfirm = !requiresPassword || !!password;

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
              <TooltipContent>Finish signing out. Sign back in within 30 days to keep your account</TooltipContent>
            </Tooltip>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canConfirm || isPending) return;
            onConfirm(requiresPassword ? password : undefined);
          }}
        >
          <div className="px-6 py-6 flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
                <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <DialogDescription asChild>
                <p className="text-sm text-foreground leading-relaxed">
                  {t("dangerZone.deleteAccount.confirmDescription")}
                </p>
              </DialogDescription>
            </div>

            {requiresPassword && (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="delete-account-password"
                  className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase"
                >
                  {t("dangerZone.deleteAccount.passwordLabel")}
                </label>
                <div className="relative">
                  <input
                    id="delete-account-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    autoComplete="current-password"
                    disabled={isPending}
                    className={`${inputClass} pr-10`}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t("dangerZone.deleteAccount.hidePassword") : t("dangerZone.deleteAccount.showPassword")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{showPassword ? t("dangerZone.deleteAccount.hidePassword") : t("dangerZone.deleteAccount.showPassword")}</TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-[12px] text-muted-foreground">{t("dangerZone.deleteAccount.passwordHint")}</p>
              </div>
            )}

            {error && <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>}
          </div>

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
                  type="submit"
                  disabled={!canConfirm || isPending}
                  className="inline-flex items-center gap-2 bg-red-600 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-red-700 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {isPending ? t("dangerZone.deleteAccount.deleting") : t("dangerZone.deleteAccount.confirmButton")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Permanently delete your account and all data</TooltipContent>
            </Tooltip>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
