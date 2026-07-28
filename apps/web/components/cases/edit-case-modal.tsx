"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, X } from "lucide-react";
import type { CaseRecord, UpdateCasePayload } from "@/lib/cases/mutations";

interface EditCaseModalProps {
  caseRecord: CaseRecord;
  isSubmitting: boolean;
  onSubmit: (payload: UpdateCasePayload) => void;
  onClose: () => void;
}

export default function EditCaseModal({ caseRecord, isSubmitting, onSubmit, onClose }: EditCaseModalProps) {
  const { t } = useTranslation("case-portfolio");
  const [caseName, setCaseName] = useState(caseRecord.caseName);
  const [partyInvolved, setPartyInvolved] = useState(caseRecord.partyInvolved ?? "");
  const [notes, setNotes] = useState(caseRecord.notes ?? "");
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!caseName.trim()) {
      setNameError(true);
      return;
    }
    onSubmit({
      caseName: caseName.trim(),
      partyInvolved,
      notes,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-lg overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-case-title"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
          <h2 id="edit-case-title" className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
            {t("Edit Case")}
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

        <div className="px-6 py-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="edit-case-name" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t("Case Name")}
            </label>
            <input
              id="edit-case-name"
              type="text"
              className={`w-full rounded-xl border bg-transparent px-3 py-2.5 outline-none text-sm transition-colors focus:ring-2 ${
                nameError
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
                  : "border-border hover:border-foreground/30 focus:border-foreground focus:ring-foreground/5"
              }`}
              value={caseName}
              onChange={(e) => {
                setCaseName(e.target.value);
                if (e.target.value.trim()) setNameError(false);
              }}
              aria-invalid={nameError}
            />
            {nameError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {t("editModal.caseNameError")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="edit-case-party" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t("detail.party")}
            </label>
            <input
              id="edit-case-party"
              type="text"
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none text-sm transition-colors hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5"
              value={partyInvolved}
              onChange={(e) => setPartyInvolved(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="edit-case-notes" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t("detail.notes")}
            </label>
            <textarea
              id="edit-case-notes"
              rows={4}
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none text-sm transition-colors resize-none hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-navy-900 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-xl hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t("editModal.saving") : t("Save Changes")}
          </button>
        </div>
      </form>
    </div>
  );
}
