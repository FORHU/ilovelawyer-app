"use client";
import React, { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/page-shell";
import CustomSelect from "@/components/ui/custom-select";
import {
  UploadCloud, FileText, X, CheckCircle2, AlertCircle, Plus, RotateCw, Loader2,
  ArrowLeft, ArrowRight, ArrowUpRight, CircleCheck, PanelsTopLeft, Scale,
} from "lucide-react";
import {
  useCreateCaseMutation,
  useUploadCaseDocumentsMutation,
} from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { generateId } from "@/lib/id";
import { useAuthStore } from "@/lib/store/auth.store";
import { getTenantCodeConfig } from "@/config/tenant-codes";

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

type UploadStatus = "pending" | "uploading" | "uploaded" | "error";

interface UploadedFile {
  id: string;
  file: File;
  status: UploadStatus;
  documentId?: string;
  error?: string;
}

type OpenTarget = "workspace" | "terminal";

export default function CreateCasePage() {
  return (
    <Suspense fallback={null}>
      <CreateCasePageContent />
    </Suspense>
  );
}

function CreateCasePageContent() {
  const { t } = useTranslation("create-case");
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode);
  const tenantConfig = getTenantCodeConfig(tenantCode);
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Set once the case is created on first submit. Kept across retries so a resubmit after a
  // partial upload failure reuses the existing case instead of creating a duplicate.
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const nextPartyIdRef = useRef(2);

  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  // Defaults to Terminal when arriving via ?next=terminal (e.g. from the Legal Terminal's own
  // "new case" entry point) — otherwise the user can still flip it before filing.
  const [openTarget, setOpenTarget] = useState<OpenTarget>(
    searchParams.get("next") === "terminal" ? "terminal" : "workspace",
  );

  const { mutateAsync: uploadDocuments } = useUploadCaseDocumentsMutation();
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

  // Uploads via presigned S3 URL (see useUploadCaseDocumentsMutation) — files are presigned
  // and confirmed in batches of 50, with a small S3 PUT pool. This only runs once the case
  // already exists (from handleSubmitFiling), so there's no separate link step afterward.
  const uploadBatch = async (entries: UploadedFile[], caseId: string): Promise<boolean> => {
    if (entries.length === 0) return true;
    entries.forEach((entry) => updateUploadedFile(entry.id, { status: "uploading", error: undefined }));

    try {
      const { confirmed, failed, succeededFiles } = await uploadDocuments({
        files: entries.map((entry) => entry.file),
        caseId,
      });

      succeededFiles.forEach((file, i) => {
        const entry = entries.find((e) => e.file === file);
        if (entry) updateUploadedFile(entry.id, { status: "uploaded", documentId: confirmed[i]?.id });
      });
      failed.forEach(({ file, reason }) => {
        const entry = entries.find((e) => e.file === file);
        if (entry) updateUploadedFile(entry.id, { status: "error", error: reason });
      });

      return failed.length === 0;
    } catch (err) {
      // The confirm call itself failed after S3 PUTs succeeded — none of these entries got a
      // DB row, so all of them (not just one) need to be retried.
      entries.forEach((entry) =>
        updateUploadedFile(entry.id, {
          status: "error",
          error: err instanceof Error ? err.message : t("sectionEvidence.uploadFailed"),
        }),
      );
      return false;
    }
  };

  // Files are only queued here, not uploaded — the case doesn't exist yet, and upload
  // doesn't start until handleSubmitFiling creates it.
  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const entries: UploadedFile[] = incoming.map((file) => ({
      id: generateId(),
      file,
      status: "pending",
    }));
    setFormData((prev) => ({
      ...prev,
      uploadedFiles: [...prev.uploadedFiles, ...entries],
    }));
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

  // Only reachable once a submit attempt has already run (that's the only way a file can be
  // in "error" state), so createdCaseId is guaranteed to be set here.
  const retryUpload = (id: string) => {
    if (!createdCaseId) return;
    const entry = formData.uploadedFiles.find((f) => f.id === id);
    if (!entry) return;
    void uploadBatch([entry], createdCaseId);
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

  // Errored files don't block resubmission — clicking submit again is the retry path, since
  // the case (once created) is reused rather than duplicated.
  const hasFilesUploading = formData.uploadedFiles.some((f) => f.status === "uploading");

  const goToStep = (n: number) => {
    if (n <= maxStepReached) setStep(n);
  };

  const handleContinue = () => {
    if (step === 1 && !formData.caseTitle.trim()) {
      setCaseTitleError(true);
      return;
    }
    const next = Math.min(3, step + 1);
    setStep(next);
    setMaxStepReached((m) => Math.max(m, next));
  };

  const handleStepBack = () => {
    if (step > 1) setStep(step - 1);
    else router.push("/homepage/case-portfolio");
  };

  const handleSubmitFiling = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step !== 3) return;
    setSubmitError(null);
    if (!formData.caseTitle.trim()) {
      setStep(1);
      setCaseTitleError(true);
      return;
    }
    if (hasFilesUploading) return;

    try {
      // Reuse the case from a prior attempt if this is a retry after some files failed to
      // upload — otherwise creating a new case on every resubmit would leave duplicates behind.
      let caseId = createdCaseId;
      if (!caseId) {
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
        caseId = newCase.id;
        setCreatedCaseId(caseId);
      }

      const pending = formData.uploadedFiles.filter((f) => f.status !== "uploaded");
      const ok = await uploadBatch(pending, caseId as string);
      if (!ok) {
        // Case already exists (createdCaseId is set) — stay on the form so the user can retry
        // the failed files individually or via resubmit, rather than losing the case entirely.
        return;
      }

      router.push(
        openTarget === "terminal"
          ? `/homepage/terminal/${caseId}`
          : `/homepage/case-portfolio/${caseId}`,
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("submitFailed"));
    }
  };

  const steps = [
    { n: 1, numeral: t("steps.identity.numeral"), title: t("steps.identity.title"), hint: t("steps.identity.hint") },
    { n: 2, numeral: t("steps.parties.numeral"), title: t("steps.parties.title"), hint: t("steps.parties.hint") },
    { n: 3, numeral: t("steps.documents.numeral"), title: t("steps.documents.title"), hint: t("steps.documents.hint") },
  ];

  return (
    <PageShell activeTab="create-case">
      <form onSubmit={handleSubmitFiling} className="flex-1 flex flex-col">
        <div className="max-w-[1000px] w-full mx-auto px-6 md:px-12 pt-24 pb-16 flex flex-col gap-8">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage/case-portfolio"
                className="self-start flex items-center gap-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                {t("backToCases")}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Return to your case portfolio list</TooltipContent>
          </Tooltip>

          <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-5 md:gap-12 items-start">
            <div className="flex flex-col gap-4 md:gap-7 md:sticky md:top-24">
              <div className="hidden md:flex flex-col gap-3">
                <h1 className="font-['Libre_Caslon_Text'] text-[40px] font-light leading-none tracking-[-0.02em] text-foreground">
                  {t("newCaseHeading")}
                </h1>
                <p className="text-muted-foreground text-[13px] leading-relaxed">
                  {t("newCaseSubheading")}
                </p>
              </div>
              {/* Compact heading on mobile — the full-size version above plus a step list with
               * hints would push the actual form off the first screen entirely. */}
              <h1 className="md:hidden font-['Libre_Caslon_Text'] text-[20px] font-light leading-none tracking-[-0.02em] text-foreground">
                {t("newCaseHeading")}
              </h1>

              {/* Compact horizontal stepper on mobile (numeral + short title only, no hint
               * text, no divider lines) — the full vertical list with hints returns at md+,
               * where it sits beside the form instead of stacked above it. */}
              <ol className="flex items-start justify-between gap-1 md:flex-col">
                {steps.map((s) => {
                  const done = s.n < step;
                  const current = s.n === step;
                  const enabled = s.n <= maxStepReached;
                  return (
                    <li
                      key={s.n}
                      onClick={() => goToStep(s.n)}
                      className={`flex flex-1 flex-col items-center gap-1.5 text-center md:flex-none md:flex-row md:items-center md:gap-3.5 md:py-3.5 md:border-t md:border-border md:text-left ${enabled ? "cursor-pointer" : "cursor-default"}`}
                    >
                      {done ? (
                        <span className="w-6 h-6 md:w-6.5 md:h-6.5 rounded-full bg-brand-gold text-brand-navy-950 flex items-center justify-center shrink-0">
                          <CircleCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                      ) : (
                        <span
                          className={`w-6 h-6 md:w-6.5 md:h-6.5 rounded-full border flex items-center justify-center shrink-0 font-['Libre_Caslon_Text'] text-xs box-border ${
                            current ? "border-brand-gold text-brand-gold" : "border-border text-muted-foreground"
                          }`}
                        >
                          {s.numeral}
                        </span>
                      )}
                      <div className="flex flex-col gap-0.5 md:contents">
                        <span className={`text-[10.5px] md:text-[13px] leading-tight font-medium ${done || current ? "text-foreground" : "text-muted-foreground"}`}>
                          {s.title}
                        </span>
                        <span className="hidden md:block text-[11.5px] text-muted-foreground leading-relaxed">{s.hint}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="flex flex-col gap-5 min-w-0">
              {submitError && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300 rounded-xl px-4 py-3" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <p className="text-sm">{submitError}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSubmitError(null)}
                        className="ml-auto rounded-full p-1 -m-1 text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30"
                        aria-label={t("dismissError")}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("dismissError")}</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {step === 1 && (
                <section className="bg-card rounded-2xl border border-border p-5 sm:p-7 md:p-8 flex flex-col gap-7">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-brand-gold">
                      {t("steps.identity.numeral")}
                    </span>
                    <h2 className="font-['Libre_Caslon_Text'] text-lg sm:text-2xl font-normal text-foreground">{t("sectionIdentity.heading")}</h2>
                    <p className="text-[13px] text-muted-foreground">{t("sectionIdentity.subheading")}</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label htmlFor="caseTitle" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      {t("sectionIdentity.caseTitleLabel")} <span className="text-brand-gold normal-case font-normal">{t("sectionIdentity.required")}</span>
                    </label>
                    <input
                      id="caseTitle"
                      type="text"
                      className={`w-full rounded-xl border bg-background px-3.5 py-3 outline-none font-['Libre_Caslon_Text'] text-[17px] transition-colors focus:ring-2 ${
                        caseTitleError
                          ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
                          : "border-border hover:border-foreground/30 focus:border-brand-gold focus:ring-brand-gold/10"
                      }`}
                      placeholder={t("sectionIdentity.caseTitlePlaceholder", { example: tenantConfig.ui.caseIntake.caseTitleExample })}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-3">
                      <label htmlFor="actionType" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        {t("sectionIdentity.actionTypeLabel")}
                      </label>
                      <CustomSelect
                        id="actionType"
                        value={formData.actionType}
                        onChange={(v) => handleInputChange("actionType", v)}
                        options={ACTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                        placeholder={t("sectionIdentity.selectAction")}
                        triggerTooltip="Choose the type of legal action"
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <label htmlFor="jurisdiction" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        {t("sectionIdentity.jurisdictionLabel")}
                      </label>
                      <input
                        id="jurisdiction"
                        type="text"
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-3 outline-none text-base sm:text-sm transition-colors hover:border-foreground/30 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
                        placeholder={t("sectionIdentity.jurisdictionPlaceholder", { example: tenantConfig.ui.caseIntake.jurisdictionExample })}
                        value={formData.jurisdiction}
                        onChange={(e) => handleInputChange("jurisdiction", e.target.value)}
                      />
                    </div>
                  </div>

                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {t("sectionIdentity.persistenceNotice")}
                  </p>
                </section>
              )}

              {step === 2 && (
                <section className="bg-card rounded-2xl border border-border p-5 sm:p-7 md:p-8 flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-brand-gold">
                      {t("steps.parties.numeral")}
                    </span>
                    <h2 className="font-['Libre_Caslon_Text'] text-lg sm:text-2xl font-normal text-foreground">{t("sectionParties.heading")}</h2>
                    <p className="text-[13px] text-muted-foreground">{t("sectionParties.subheading")}</p>
                  </div>

                  <div className="relative">
                    {/* Bounded + scrollable instead of growing the page forever: 1-3 parties
                        fit with no scrollbar at all, more than that scrolls within this box.
                        Below md the bound is dropped entirely — a scroll box nested inside an
                        already-scrolling page is a mobile friction point (see ADR 0007). */}
                    <div className="flex flex-col gap-3.5 md:max-h-105 md:overflow-y-auto pr-1 -mr-1">
                      {formData.parties.map((party, index) => (
                        <div key={party.id} className="border border-border rounded-xl p-4.5 flex flex-col gap-4 bg-background">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                              {t("sectionParties.partyLabel", { number: index + 1 })}
                            </span>
                            {formData.parties.length > 1 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => removeParty(party.id)}
                                    className="cursor-pointer rounded-full p-2 -m-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                                    aria-label={t("sectionParties.removeParty", { number: index + 1 })}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>{t("sectionParties.removeParty", { number: index + 1 })}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                              <label htmlFor={`party-name-${party.id}`} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                {t("sectionParties.fullNameLabel")}
                              </label>
                              <input
                                id={`party-name-${party.id}`}
                                type="text"
                                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 outline-none text-base sm:text-sm transition-colors hover:border-foreground/30 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
                                placeholder={t("sectionParties.fullNamePlaceholder")}
                                value={party.name}
                                onChange={(e) => updateParty(party.id, "name", e.target.value)}
                              />
                            </div>

                            <div className="flex flex-col gap-2">
                              <label htmlFor={`party-designation-${party.id}`} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                {t("sectionParties.designationLabel")}
                              </label>
                              <CustomSelect
                                id={`party-designation-${party.id}`}
                                value={party.designation}
                                onChange={(v) => updateParty(party.id, "designation", v)}
                                options={DESIGNATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                                triggerTooltip="Choose the party's designation"
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

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={addParty}
                        className="self-start flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/40 border border-dashed border-border rounded-full px-4 py-2.5 uppercase transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        {t("sectionParties.addParty")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Add another party to this case</TooltipContent>
                  </Tooltip>
                </section>
              )}

              {step === 3 && (
                <section className="bg-card rounded-2xl border border-border p-5 sm:p-7 md:p-8 flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-brand-gold">
                      {t("steps.documents.numeral")}
                    </span>
                    <h2 className="font-['Libre_Caslon_Text'] text-lg sm:text-2xl font-normal text-foreground">{t("sectionEvidence.heading")}</h2>
                    <p className="text-[13px] text-muted-foreground">{t("sectionEvidence.subheading")}</p>
                  </div>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={triggerFileSelect}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && triggerFileSelect()}
                    className={`border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                      isDragActive ? "border-brand-gold bg-background" : "border-border bg-background hover:border-foreground/30"
                    }`}
                  >
                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      className="hidden"
                      accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                    />

                    <UploadCloud className="w-6.5 h-6.5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <h4 className="font-['Libre_Caslon_Text'] text-lg text-foreground">
                      {t("sectionEvidence.depositCaseFiles")}
                    </h4>
                    <p className="text-muted-foreground text-[12.5px]">
                      {t("sectionEvidence.dropHint")}
                    </p>
                  </div>

                  {formData.uploadedFiles.length > 0 && (
                    <div className="flex flex-col border border-border rounded-xl overflow-hidden">
                      {formData.uploadedFiles.map((f) => (
                        <div key={f.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 text-[13px]">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                          <span className="flex-1 min-w-0 truncate">{f.file.name}</span>
                          <span className="text-[11px] text-muted-foreground">{(f.file.size / 1024).toFixed(1)} KB</span>
                          {f.status === "uploading" && (
                            <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" aria-hidden="true" />
                          )}
                          {f.status === "uploaded" && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                          )}
                          {f.status === "error" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => retryUpload(f.id)}
                                  className="flex items-center gap-1 rounded p-0.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30"
                                  aria-label={t("sectionEvidence.retryUpload", { fileName: f.file.name })}
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{t("sectionEvidence.retryUpload", { fileName: f.file.name })}</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => removeFile(f.id)}
                                className="rounded p-0.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                                aria-label={t("sectionEvidence.removeFile", { fileName: f.file.name })}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{t("sectionEvidence.removeFile", { fileName: f.file.name })}</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 pt-2 border-t border-border">
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{t("openInLabel")}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenTarget("workspace")}
                        className={`h-11 sm:h-9 inline-flex items-center gap-2 px-4 rounded-full text-[10px] font-semibold tracking-[1.2px] uppercase transition-colors cursor-pointer ${
                          openTarget === "workspace"
                            ? "bg-foreground text-background"
                            : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                        }`}
                      >
                        <PanelsTopLeft className="w-3.5 h-3.5" aria-hidden="true" />
                        {t("openInWorkspace")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenTarget("terminal")}
                        className={`h-11 sm:h-9 inline-flex items-center gap-2 px-4 rounded-full text-[10px] font-semibold tracking-[1.2px] uppercase transition-colors cursor-pointer ${
                          openTarget === "terminal"
                            ? "bg-foreground text-background"
                            : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" aria-hidden="true" />
                        {t("openInTerminal")}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              <div className={`flex items-center gap-4 ${step === 1 ? "justify-end sm:justify-between" : "justify-between"}`}>
                {/* On step 1, this button and the "Cases" link at the top of the page do the
                 * exact same thing (leave the wizard) — redundant on mobile, where the link
                 * above is already on screen. Desktop keeps it for symmetry with steps 2/3. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleStepBack}
                      className={`h-11 sm:h-10 px-4.5 rounded-full border border-border text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground hover:border-foreground/40 transition-colors cursor-pointer ${
                        step === 1 ? "hidden sm:block" : ""
                      }`}
                    >
                      {t("back")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{step > 1 ? "Go back to the previous step" : "Discard and return to Cases"}</TooltipContent>
                </Tooltip>

                {step < 3 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleContinue}
                        className="flex items-center gap-2.5 h-11 sm:h-10 px-5 rounded-full bg-brand-gold text-brand-navy-950 text-[10px] font-semibold tracking-[1.2px] uppercase hover:opacity-85 transition-opacity cursor-pointer"
                      >
                        {t("continue")}
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Continue to the next step</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="submit"
                        disabled={hasFilesUploading || isSubmitting}
                        className="flex items-center gap-2.5 h-11 sm:h-10 px-5 rounded-full bg-brand-gold text-brand-navy-950 text-[10px] font-semibold tracking-[1.2px] uppercase hover:opacity-85 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? t("submitting") : t("initiateFiling")}
                        {!isSubmitting && <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Create the case with the details entered above</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </PageShell>
  );
}
