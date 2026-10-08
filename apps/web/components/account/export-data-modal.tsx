"use client";
import { useState } from "react";
import { Download, Eye, EyeOff, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

interface ExportDataModalProps {
  isPending: boolean;
  error?: string | null;
  /** Password accounts re-enter their password before their data is released; Google SSO accounts
   * have none, so they confirm without one. */
  requiresPassword: boolean;
  onConfirm: (password?: string) => void;
  onClose: () => void;
}

export default function ExportDataModal({ isPending, error, requiresPassword, onConfirm, onClose }: ExportDataModalProps) {
  const { t } = useTranslation("profile");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canConfirm = !requiresPassword || !!password;

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">{t("yourData.download.confirmTitle")}</h2>
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t("yourData.download.closeModal")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("yourData.download.closeModal")}</TooltipContent>
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <Download className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <DialogDescription asChild>
                <p className="text-sm text-foreground leading-relaxed">{t("yourData.download.confirmDescription")}</p>
              </DialogDescription>
            </div>

            {requiresPassword && (
              <div className="flex flex-col gap-2">
                <label htmlFor="export-data-password" className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                  {t("yourData.download.passwordLabel")}
                </label>
                <div className="relative">
                  <input
                    id="export-data-password"
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
                        aria-label={showPassword ? t("yourData.download.hidePassword") : t("yourData.download.showPassword")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{showPassword ? t("yourData.download.hidePassword") : t("yourData.download.showPassword")}</TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-[12px] text-muted-foreground">{t("yourData.download.passwordHint")}</p>
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
                  {t("yourData.download.cancel")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Close this dialog without downloading</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  disabled={!canConfirm || isPending}
                  className="inline-flex items-center gap-2 bg-brand-navy-900 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {isPending ? t("yourData.download.preparing") : t("yourData.download.confirmButton")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Prepare and download your data</TooltipContent>
            </Tooltip>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
