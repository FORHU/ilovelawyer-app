"use client";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface DeactivateAccountModalProps {
  isPending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeactivateAccountModal({ isPending, error, onConfirm, onClose }: DeactivateAccountModalProps) {
  const { t } = useTranslation("profile");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card rounded-2xl border border-border shadow-lg overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="deactivate-account-title"
        aria-describedby="deactivate-account-desc"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <h2 id="deactivate-account-title" className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
            {t("Disable Account")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={t("Close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-6 flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <p id="deactivate-account-desc" className="text-sm text-foreground leading-relaxed">
            {t("Are you sure you want to disable your account? You'll be signed out immediately and won't be able to log back in until an administrator reactivates your account.")}
          </p>
        </div>

        {error && (
          <div className="px-6 pb-4 -mt-2">
            <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-amber-600 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-xl hover:bg-amber-700 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {isPending ? t("dangerZone.disableAccount.disabling") : t("Yes, Disable Account")}
          </button>
        </div>
      </div>
    </div>
  );
}
