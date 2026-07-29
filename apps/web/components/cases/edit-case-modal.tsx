"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Plus, X } from "lucide-react";
import CustomSelect from "@/components/ui/custom-select";
import type { CaseRecord, UpdateCasePayload } from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

const DESIGNATION_OPTIONS = [
  { value: "Petitioner / Plaintiff", labelKey: "designations.petitionerPlaintiff" },
  { value: "Respondent / Defendant", labelKey: "designations.respondentDefendant" },
  { value: "Intervenor / Third-Party", labelKey: "designations.intervenorThirdParty" },
] as const;

interface Party {
  id: string;
  name: string;
  designation: string;
}

// caseRecord.partyInvolved is the "{{name}} ({{designation}}); {{name}} ({{designation}})"
// string produced by this same join on the Create Case page — parse it back into rows so
// existing parties are editable, not just appendable.
function parsePartyInvolved(raw: string | null): Party[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [{ id: "party-1", name: "", designation: DESIGNATION_OPTIONS[0].value }];

  return trimmed.split(";").map((segment, index) => {
    const match = segment.trim().match(/^(.*)\s\((.+)\)$/);
    const designation = match?.[2]?.trim();
    const isKnownDesignation = DESIGNATION_OPTIONS.some((o) => o.value === designation);
    const name = isKnownDesignation ? (match?.[1] ?? segment) : segment;
    return {
      id: `party-${index + 1}`,
      name: name.trim(),
      designation: isKnownDesignation && designation ? designation : DESIGNATION_OPTIONS[0].value,
    };
  });
}

interface EditCaseModalProps {
  caseRecord: CaseRecord;
  isSubmitting: boolean;
  onSubmit: (payload: UpdateCasePayload) => void;
  onClose: () => void;
}

export default function EditCaseModal({ caseRecord, isSubmitting, onSubmit, onClose }: EditCaseModalProps) {
  const { t } = useTranslation(["case-portfolio", "create-case"]);
  const [caseName, setCaseName] = useState(caseRecord.caseName);
  const [parties, setParties] = useState<Party[]>(() => parsePartyInvolved(caseRecord.partyInvolved));
  const [notes, setNotes] = useState(caseRecord.notes ?? "");
  const [nameError, setNameError] = useState(false);
  const nextPartyIdRef = useRef(parties.length + 1);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const updateParty = (id: string, field: "name" | "designation", value: string) => {
    setParties((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const addParty = () => {
    const id = `party-${nextPartyIdRef.current++}`;
    setParties((prev) => [...prev, { id, name: "", designation: "Respondent / Defendant" }]);
  };

  const removeParty = (id: string) => {
    setParties((prev) => {
      if (prev.length <= 1) return prev;
      const target = prev.find((p) => p.id === id);
      if (target?.name.trim() && !window.confirm(t("sectionParties.removePartyConfirm", { name: target.name, ns: "create-case" }))) {
        return prev;
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!caseName.trim()) {
      setNameError(true);
      return;
    }
    const partyInvolved = parties
      .filter((p) => p.name.trim())
      .map((p) => `${p.name.trim()} (${p.designation})`)
      .join("; ");

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
        className="w-full max-w-2xl max-h-[calc(100vh-4rem)] bg-card rounded-2xl border border-border shadow-lg overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-case-title"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60 shrink-0">
          <h2 id="edit-case-title" className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
            {t("Edit Case")}
          </h2>
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

        <div className="px-6 py-6 flex flex-col gap-5 overflow-y-auto">
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

          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t("detail.party")}
            </span>

            <div className="flex flex-col gap-3">
              {parties.map((party, index) => (
                <div
                  key={party.id}
                  className="border border-l-4 border-border border-l-primary/15 rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-l-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      {t("sectionParties.partyLabel", { number: index + 1, ns: "create-case" })}
                    </span>
                    {parties.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeParty(party.id)}
                        className="cursor-pointer rounded-full p-2 -m-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                        aria-label={t("sectionParties.removeParty", { number: index + 1, ns: "create-case" })}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor={`edit-party-name-${party.id}`} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        {t("sectionParties.fullNameLabel", { ns: "create-case" })}
                      </label>
                      <input
                        id={`edit-party-name-${party.id}`}
                        type="text"
                        className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none text-sm transition-colors hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5"
                        placeholder={t("sectionParties.fullNamePlaceholder", { ns: "create-case" })}
                        value={party.name}
                        onChange={(e) => updateParty(party.id, "name", e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor={`edit-party-designation-${party.id}`} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        {t("sectionParties.designationLabel", { ns: "create-case" })}
                      </label>
                      <CustomSelect
                        id={`edit-party-designation-${party.id}`}
                        value={party.designation}
                        onChange={(v) => updateParty(party.id, "designation", v)}
                        options={DESIGNATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey, { ns: "create-case" }) }))}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addParty}
              className="self-start flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-muted border border-dashed border-border rounded-full px-4 py-2.5 uppercase transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              {t("sectionParties.addParty", { ns: "create-case" })}
            </button>
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

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                {t("Cancel")}
              </button>
            </TooltipTrigger>
            <TooltipContent>Discard changes and close without saving</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand-navy-900 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-xl hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t("editModal.saving") : t("Save Changes")}
              </button>
            </TooltipTrigger>
            <TooltipContent>Save the updated case name, party, and notes</TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
