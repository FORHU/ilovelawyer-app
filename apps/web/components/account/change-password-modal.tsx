"use client";
import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

interface ChangePasswordModalProps {
  isPending: boolean;
  error?: string | null;
  onSubmit: (currentPassword: string, newPassword: string) => void;
  onClose: () => void;
}

export default function ChangePasswordModal({ isPending, error, onSubmit, onClose }: ChangePasswordModalProps) {
  const { t } = useTranslation("profile");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const newPasswordValid = newPassword.length >= 8 && /[^a-zA-Z0-9]/.test(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canSubmit = !!currentPassword && newPasswordValid && passwordsMatch;

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
              {t("security.changePassword.title")}
            </h2>
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t("security.changePassword.closeModal")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("security.changePassword.closeModal")}</TooltipContent>
          </Tooltip>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            onSubmit(currentPassword, newPassword);
          }}
        >
          <div className="px-6 py-6 flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <KeyRound className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <DialogDescription asChild>
                <p className="text-sm text-foreground leading-relaxed">{t("security.changePassword.description")}</p>
              </DialogDescription>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                {t("security.changePassword.currentPasswordLabel")}
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoFocus
                  autoComplete="current-password"
                  className={`${inputClass} pr-10`}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      aria-label={showCurrent ? t("security.changePassword.hidePassword") : t("security.changePassword.showPassword")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{showCurrent ? t("security.changePassword.hidePassword") : t("security.changePassword.showPassword")}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                {t("security.changePassword.newPasswordLabel")}
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputClass} pr-10`}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      aria-label={showNew ? t("security.changePassword.hidePassword") : t("security.changePassword.showPassword")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{showNew ? t("security.changePassword.hidePassword") : t("security.changePassword.showPassword")}</TooltipContent>
                </Tooltip>
              </div>
              {newPassword && !newPasswordValid && (
                <p className="text-[12px] text-red-600 dark:text-red-400">{t("security.changePassword.newPasswordRequirement")}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                {t("security.changePassword.confirmPasswordLabel")}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputClass} pr-10`}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? t("security.changePassword.hidePassword") : t("security.changePassword.showPassword")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{showConfirm ? t("security.changePassword.hidePassword") : t("security.changePassword.showPassword")}</TooltipContent>
                </Tooltip>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-[12px] text-red-600 dark:text-red-400">{t("security.changePassword.passwordsMismatch")}</p>
              )}
            </div>

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
                  {t("security.changePassword.cancel")}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("security.changePassword.cancelTooltip")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  disabled={!canSubmit || isPending}
                  className="inline-flex items-center gap-2 bg-brand-navy-900 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {isPending ? t("security.changePassword.saving") : t("security.changePassword.submit")}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("security.changePassword.submitTooltip")}</TooltipContent>
            </Tooltip>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
