"use client";
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import GlobalFooter from "@/components/global-footer";
import CustomSelect from "@/components/ui/custom-select";
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle, Plus, RotateCw, Scale, Users, Loader2 } from "lucide-react";
import {
  useCreateCaseMutation,
  useUploadCaseDocumentMutation,
  useLinkCaseDocumentMutation,
} from "@/lib/cases/mutations";

const ACTION_TYPE_OPTIONS = [
  { value: "Civil Litigation", labelKey: "actionTypes.civilLitigation" },
  { value: "Criminal Proceeding", labelKey: "actionTypes.criminalProceeding" },
  { value: "Labor Dispute", labelKey: "actionTypes.laborDispute" },
  { value: "Commercial Arbitration", labelKey: "actionTypes.commercialArbitration" },
] as const;

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

type UploadStatus = "uploading" | "uploaded" | "error";

interface UploadedFile {
  id: string;
  file: File;
  status: UploadStatus;
  documentId?: string;
  error?: string;
}


export default function CreateCasePage() {
  const { t } = useTranslation("create-case");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Seeded party keeps a stable id (safe for the initial server/client render);
  // parties added afterward only ever happen client-side, via addParty below.
  const [formData, setFormData] = useState({
    caseTitle: "",
    actionType: "",
    jurisdiction: "",
    parties: [{ id: "party-1", name: "", designation: "Petitioner / Plaintiff" }] as Party[],
    uploadedFiles: [] as UploadedFile[],
  });
  const [caseTitleError, setCaseTitleError] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const nextPartyIdRef = useRef(2);

  const { mutateAsync: uploadDocument } = useUploadCaseDocumentMutation();
  const { mutateAsync: linkDocument } = useLinkCaseDocumentMutation();
  const { mutateAsync: createCase, isPending: isSubmitting } = useCreateCaseMutation();

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "caseTitle" && value.trim()) setCaseTitleError(false);
  };

  const updateParty = (id: string, field: "name" | "designation", value: string) => {
    setFormData((prev) => ({
      ...prev,
      parties: prev.parties.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    }));
  };

  const addParty = () => {
    const id = `party-${nextPartyIdRef.current++}`;
    setFormData((prev) => ({
      ...prev,
      // New additions default to the opposing side, since the first party is
      // already a Petitioner/Plaintiff by default — the common case.
      parties: [...prev.parties, { id, name: "", designation: "Respondent / Defendant" }],
    }));
  };

  const removeParty = (id: string) => {
    setFormData((prev) => {
      if (prev.parties.length <= 1) return prev;
      const target = prev.parties.find((p) => p.id === id);
      // Only prompt when there's actually something typed to lose — an untouched
      // blank row can be removed without friction.
      if (target?.name.trim() && !window.confirm(t("sectionParties.removePartyConfirm", { name: target.name }))) {
        return prev;
      }
      return { ...prev, parties: prev.parties.filter((p) => p.id !== id) };
    });
  };

  const updateUploadedFile = (id: string, patch: Partial<UploadedFile>) => {
    setFormData((prev) => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  };

  // Uploads straight to our own API (POST /api/documents, multipart) — the document isn't
  // linked to a case yet, since the case doesn't exist until the form is submitted. The link
  // happens in handleSubmitFiling once the case's id is known.
  const uploadOne = async (entry: UploadedFile) => {
    try {
      const doc = await uploadDocument({ file: entry.file });
      updateUploadedFile(entry.id, { status: "uploaded", documentId: doc.id });
    } catch (err) {
      updateUploadedFile(entry.id, {
        status: "error",
        error: err instanceof Error ? err.message : t("sectionEvidence.uploadFailed"),
      });
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const entries: UploadedFile[] = incoming.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "uploading",
    }));
    setFormData((prev) => ({
      ...prev,
      uploadedFiles: [...prev.uploadedFiles, ...entries],
    }));
    entries.forEach((entry) => void uploadOne(entry));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files || []);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((f) => f.id !== id),
    }));
  };

  const retryUpload = (id: string) => {
    const entry = formData.uploadedFiles.find((f) => f.id === id);
    if (!entry) return;
    updateUploadedFile(id, { status: "uploading", error: undefined });
    void uploadOne({ ...entry, status: "uploading", error: undefined });
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  const hasFilesUploading = formData.uploadedFiles.some((f) => f.status === "uploading");
  const hasFailedUploads = formData.uploadedFiles.some((f) => f.status === "error");

  const handleSubmitFiling = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittedTitle(null);
    setSubmitError(null);
    if (!formData.caseTitle.trim()) {
      setCaseTitleError(true);
      return;
    }
    if (hasFilesUploading || hasFailedUploads) return;

    try {
      // Type of Action and Jurisdiction have no home on the backend yet (see CONTEXT.md
      // pending section) — they're captured in the form but not sent. Parties collapse into
      // the single `partyInvolved` string the backend does support.
      const partyInvolved = formData.parties
        .filter((p) => p.name.trim())
        .map((p) => `${p.name.trim()} (${p.designation})`)
        .join("; ");

      const newCase = await createCase({
        caseName: formData.caseTitle.trim(),
        partyInvolved: partyInvolved || undefined,
      });

      const documentIds = formData.uploadedFiles
        .filter((f): f is UploadedFile & { documentId: string } => f.status === "uploaded" && !!f.documentId);
      await Promise.all(documentIds.map((f) => linkDocument({ documentId: f.documentId, caseId: newCase.id })));

      setSubmittedTitle(formData.caseTitle);
      setFormData({
        caseTitle: "",
        actionType: "",
        jurisdiction: "",
        parties: [{ id: "party-1", name: "", designation: "Petitioner / Plaintiff" }],
        uploadedFiles: [],
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("submitFailed"));
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">

      <GlobalHeader activeTab="create-case" />

      {/* CORE CANVAS WORKSPACE */}
      <form onSubmit={handleSubmitFiling} className="w-full flex flex-col flex-1">

        {/* HERO BACKDROP */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-800 to-brand-navy-950 py-14 md:py-16">
          <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-[#c9c9c9]/10 blur-3xl" aria-hidden="true" />
          <div className="relative max-w-4xl w-full mx-auto px-6 md:px-12 flex flex-col gap-2">
            <h1 className="font-['Libre_Caslon_Text'] text-3xl md:text-4xl text-white font-normal tracking-[-0.6px]">
              {t("title")}
            </h1>
            <p className="text-white/70 text-sm max-w-md">
              {t("subtitle")}
            </p>
          </div>
        </section>

        {/* INTAKE FORM CONTENT */}
        <section className="max-w-4xl w-full mx-auto px-6 md:px-12 py-10 md:py-12 flex flex-col gap-8 font-['Inter']">
          {submittedTitle && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300 rounded-xl px-4 py-3" role="status">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="text-sm">
                {t("filingInitialized", { title: submittedTitle })}
              </p>
              <button
                type="button"
                onClick={() => setSubmittedTitle(null)}
                className="ml-auto rounded-full p-1 -m-1 text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                aria-label={t("dismissConfirmation")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {submitError && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300 rounded-xl px-4 py-3" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="text-sm">{submitError}</p>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                className="ml-auto rounded-full p-1 -m-1 text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30"
                aria-label={t("dismissError")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* SECTION I: IDENTITY */}
          <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 md:px-8 py-5 border-b border-border bg-muted/60">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <Scale className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">{t("sectionIdentity.heading")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("sectionIdentity.subheading")}</p>
              </div>
            </div>

            <fieldset className="px-6 md:px-8 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <label htmlFor="caseTitle" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {t("sectionIdentity.caseTitleLabel")} <span className="text-muted-foreground normal-case font-normal">{t("sectionIdentity.required")}</span>
                  </label>
                  <input
                    id="caseTitle"
                    type="text"
                    className={`w-full rounded-xl border bg-transparent px-3 py-2.5 outline-none text-sm transition-colors focus:ring-2 ${
                      caseTitleError
                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
                        : "border-border hover:border-foreground/30 focus:border-foreground focus:ring-foreground/5"
                    }`}
                    placeholder={t("sectionIdentity.caseTitlePlaceholder")}
                    value={formData.caseTitle}
                    onChange={(e) => handleInputChange("caseTitle", e.target.value)}
                    aria-invalid={caseTitleError}
                    aria-describedby={caseTitleError ? "caseTitle-error" : undefined}
                  />
                  {caseTitleError && (
                    <p id="caseTitle-error" className="flex items-center gap-1.5 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {t("sectionIdentity.caseTitleError")}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <label htmlFor="actionType" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {t("sectionIdentity.actionTypeLabel")}
                  </label>
                  <CustomSelect
                    id="actionType"
                    value={formData.actionType}
                    onChange={(v) => handleInputChange("actionType", v)}
                    options={ACTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                    placeholder={t("sectionIdentity.selectAction")}
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-3">
                  <label htmlFor="jurisdiction" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {t("sectionIdentity.jurisdictionLabel")}
                  </label>
                  <input
                    id="jurisdiction"
                    type="text"
                    className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none text-sm transition-colors hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5"
                    placeholder={t("sectionIdentity.jurisdictionPlaceholder")}
                    value={formData.jurisdiction}
                    onChange={(e) => handleInputChange("jurisdiction", e.target.value)}
                  />
                </div>

                <p className="md:col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground italic">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {t("sectionIdentity.persistenceNotice")}
                </p>
              </div>
            </fieldset>
          </section>

          {/* SECTION II: PARTY DETAILS */}
          <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 md:px-8 py-5 border-b border-border bg-muted/60">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <Users className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">{t("sectionParties.heading")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("sectionParties.subheading")}</p>
              </div>
            </div>

            <fieldset className="px-6 md:px-8 py-6 flex flex-col gap-6">
              <div className="relative">
                {/* Bounded + scrollable instead of growing the page forever: 1-3 parties
                    fit with no scrollbar at all, more than that scrolls within this box.
                    Below md the bound is dropped entirely — a scroll box nested inside an
                    already-scrolling page is a mobile friction point (see ADR 0007). */}
                <div className="flex flex-col gap-4 md:max-h-105 md:overflow-y-auto pr-1 -mr-1">
                  {formData.parties.map((party, index) => (
                    <div key={party.id} className="border border-l-4 border-border border-l-primary/15 rounded-xl p-5 flex flex-col gap-5 transition-colors hover:border-l-primary/30">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                          {t("sectionParties.partyLabel", { number: index + 1 })}
                        </span>
                        {formData.parties.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParty(party.id)}
                            className="cursor-pointer rounded-full p-2 -m-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                            aria-label={t("sectionParties.removeParty", { number: index + 1 })}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-3">
                          <label htmlFor={`party-name-${party.id}`} className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                            {t("sectionParties.fullNameLabel")}
                          </label>
                          <input
                            id={`party-name-${party.id}`}
                            type="text"
                            className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none text-sm transition-colors hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5"
                            placeholder={t("sectionParties.fullNamePlaceholder")}
                            value={party.name}
                            onChange={(e) => updateParty(party.id, "name", e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col gap-3">
                          <label htmlFor={`party-designation-${party.id}`} className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                            {t("sectionParties.designationLabel")}
                          </label>
                          <CustomSelect
                            id={`party-designation-${party.id}`}
                            value={party.designation}
                            onChange={(v) => updateParty(party.id, "designation", v)}
                            options={DESIGNATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {formData.parties.length > 3 && (
                  <div className="hidden md:block pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-linear-to-t from-card to-transparent" />
                )}
              </div>

              <button
                type="button"
                onClick={addParty}
                className="self-start flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-muted border border-dashed border-border rounded-full px-4 py-2.5 uppercase transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                {t("sectionParties.addParty")}
              </button>
            </fieldset>
          </section>

          {/* SECTION III: EVIDENTIARY SUBMISSIONS */}
          <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 md:px-8 py-5 border-b border-border bg-muted/60">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">{t("sectionEvidence.heading")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("sectionEvidence.subheading")}</p>
              </div>
            </div>

            <fieldset className="px-6 md:px-8 py-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && triggerFileSelect()}
                className={`border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 relative cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  isDragActive ? "border-primary bg-muted" : "border-border bg-muted/40 hover:border-foreground/30"
                }`}
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                />

                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm">
                  <UploadCloud className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                </div>

                <div>
                  <h4 className="font-['Libre_Caslon_Text'] text-lg text-foreground mb-1">
                    {t("sectionEvidence.depositCaseFiles")}
                  </h4>
                  <p className="text-muted-foreground text-sm italic font-light">
                    {t("sectionEvidence.dropHint")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileSelect();
                  }}
                  className="bg-brand-navy-900 text-white text-xs font-semibold tracking-wider px-6 py-3.5 rounded-xl hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2"
                >
                  {t("sectionEvidence.selectDocuments")}
                </button>

                {formData.uploadedFiles.length > 0 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md mt-4 text-left bg-card border border-border rounded-xl p-4 text-xs text-foreground flex flex-col gap-2 max-h-40 overflow-y-auto"
                  >
                    <p className="font-bold border-b pb-1 mb-1 text-muted-foreground">{t("sectionEvidence.attachedDossiers", { count: formData.uploadedFiles.length })}</p>
                    {formData.uploadedFiles.map((f) => (
                      <div key={f.id} className="flex flex-col gap-1 py-0.5">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                          <span className="truncate flex-1">{f.file.name} ({(f.file.size / 1024).toFixed(1)} KB)</span>
                          {f.status === "uploading" && (
                            <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" aria-hidden="true" />
                          )}
                          {f.status === "uploaded" && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                          )}
                          {f.status === "error" && (
                            <button
                              type="button"
                              onClick={() => retryUpload(f.id)}
                              className="flex items-center gap-1 rounded p-0.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30"
                              aria-label={t("sectionEvidence.retryUpload", { fileName: f.file.name })}
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(f.id)}
                            className="rounded p-0.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                            aria-label={t("sectionEvidence.removeFile", { fileName: f.file.name })}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {f.status === "error" && (
                          <p className="text-red-600 dark:text-red-400">{f.error ?? t("sectionEvidence.uploadFailed")}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </fieldset>
          </section>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={hasFilesUploading || hasFailedUploads || isSubmitting}
              className="bg-brand-navy-900 text-white rounded-xl font-medium tracking-widest text-sm px-10 py-4 hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t("submitting") : t("initiateFiling")}
            </button>
            <p className="text-xs text-muted-foreground">{t("editAnytimeNote")}</p>
          </div>
        </section>
      </form>

      <SiteFooter />
    </div>
  );
}
