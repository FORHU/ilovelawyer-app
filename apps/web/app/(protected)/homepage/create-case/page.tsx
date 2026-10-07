"use client";
import React, { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import CustomSelect from "@/components/ui/custom-select";
import {
  UploadCloud, FileText, X, CheckCircle2, AlertCircle, Plus, RotateCw, Loader2,
  ArrowLeft, ArrowRight, ArrowUpRight, CircleCheck, PanelsTopLeft, Scale,
} from "lucide-react";
import {
  useCreateCaseMutation,
  useUploadCaseDocumentsMutation,
  type ClientSide,
} from "@/lib/cases/mutations";
import { ALLOWED_EXTENSIONS, ALLOWED_FILE_TYPES_LABEL, isAllowedFileType, MAX_FILE_SIZE_BYTES } from "@/lib/cases/upload-batch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { generateId } from "@/lib/id";
import { CASE_NAME_MAX_LENGTH, PARTY_NAME_MAX_LENGTH } from "@/lib/cases/limits";
import { CharCount } from "@/components/ui/char-count";
import { DesignationPicker, splitDesignationLabel } from "@/components/cases/designation-picker";
import { useAuthStore } from "@/lib/store/auth.store";
import { getTenantCodeConfig, UK_JURISDICTION_LABEL_KEYS } from "@/config/tenant-codes";

const DESIGNATION_OPTIONS = [
  { value: "Petitioner / Plaintiff", labelKey: "designations.petitionerPlaintiff" },
  { value: "Respondent / Defendant", labelKey: "designations.respondentDefendant" },
  { value: "Intervenor / Third-Party", labelKey: "designations.intervenorThirdParty" },
] as const;

// "" = not chosen yet; the lawyer can still set it from the case's overview later.
const CLIENT_SIDE_OPTIONS = [
  { value: "", labelKey: "sectionParties.clientSideUnset" },
  { value: "CLAIMANT", labelKey: "sectionParties.clientSideClaimant" },
  { value: "RESPONDENT", labelKey: "sectionParties.clientSideRespondent" },
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

// Parties listed in the filing summary before the rest fold behind "+N more".
const SUMMARY_PARTY_LIMIT = 4;

// Persists everything except uploadedFiles — raw File objects can't survive a refresh (the
// browser drops their content for security reasons), so a not-yet-uploaded selection is
// unavoidably lost. Everything else the user typed in (title, parties, jurisdiction, which step
// they were on, and the case once it exists server-side) is restored instead of vanishing.
const DRAFT_STORAGE_KEY = "create-case:draft";

interface CaseDraft {
  caseTitle: string;
  jurisdiction: string;
  ukJurisdiction: string;
  parties: Party[];
  clientSide?: ClientSide | "";
  step: number;
  maxStepReached: number;
  openTarget: OpenTarget;
  createdCaseId: string | null;
}

function loadDraft(): CaseDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CaseDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: CaseDraft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — draft persistence is a nicety,
    // not something worth surfacing an error for.
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage was never writable to begin with.
  }
}

/** Step II is complete once every party row has a name — a blank party isn't a party. */
function partiesComplete(parties: Party[]): boolean {
  return parties.length > 0 && parties.every((p) => p.name.trim());
}

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
    jurisdiction: "",
    ukJurisdiction: "",
    parties: [{ id: "party-1", name: "", designation: "Petitioner / Plaintiff" }] as Party[],
    clientSide: "" as ClientSide | "",
    uploadedFiles: [] as UploadedFile[],
  });
  const [caseTitleError, setCaseTitleError] = useState(false);
  const [showAllParties, setShowAllParties] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Set once the case is created on first submit. Kept across retries so a resubmit after a
  // partial upload failure reuses the existing case instead of creating a duplicate.
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const nextPartyIdRef = useRef(2);

  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  // Continue (steps 1-2) and File (step 3) occupy the same spot in the button row, so a fast
  // double-click on Continue can land its second click on File the instant step 3 mounts,
  // submitting with zero files before the user ever sees the dropzone. Guards handleSubmitFiling
  // against firing within this window of a step change landing on 3.
  const stepEnteredAtRef = useRef(Date.now());
  // Defaults to Terminal when arriving via ?next=terminal (e.g. from the Legal Terminal's own
  // "new case" entry point) — otherwise the user can still flip it before filing.
  const [openTarget, setOpenTarget] = useState<OpenTarget>(
    searchParams.get("next") === "terminal" ? "terminal" : "workspace",
  );

  const { mutateAsync: uploadDocuments } = useUploadCaseDocumentsMutation();
  const { mutateAsync: createCase, isPending: isSubmitting } = useCreateCaseMutation();

  // A draft left behind (a refresh, or a case started earlier and abandoned) is offered, never
  // restored silently: that used to drop the user straight onto step III of an old case, one
  // click from filing it. Read once after mount (not in a lazy useState initializer), so the
  // client's first render still matches the server's.
  const [pendingDraft, setPendingDraft] = useState<CaseDraft | null>(null);
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;
    const draft = loadDraft();
    if (draft) setPendingDraft(draft);
  }, []);

  const discardDraft = () => {
    clearDraft();
    setPendingDraft(null);
  };

  const resumeDraft = () => {
    const draft = pendingDraft;
    if (!draft) return;
    setPendingDraft(null);
    setFormData((prev) => ({
      ...prev,
      // Clipped to the field limits: a draft saved before they existed could be longer, and
      // the inputs' maxLength doesn't trim a value that's already there.
      caseTitle: draft.caseTitle.slice(0, CASE_NAME_MAX_LENGTH),
      jurisdiction: draft.jurisdiction,
      ukJurisdiction: draft.ukJurisdiction,
      parties:
        draft.parties.length > 0
          ? draft.parties.map((p) => ({ ...p, name: p.name.slice(0, PARTY_NAME_MAX_LENGTH) }))
          : prev.parties,
      // Drafts saved before this field existed don't carry it.
      clientSide: draft.clientSide ?? "",
    }));
    // The first incomplete step, not necessarily the one it was left on.
    const resumeStep = !draft.caseTitle.trim() ? 1 : !partiesComplete(draft.parties) ? Math.min(draft.step, 2) : draft.step;
    setStep(resumeStep);
    setMaxStepReached(draft.maxStepReached);
    setOpenTarget(draft.openTarget);
    setCreatedCaseId(draft.createdCaseId);
    stepEnteredAtRef.current = Date.now();

    const highestPartyId = draft.parties.reduce((max, p) => {
      const match = /^party-(\d+)$/.exec(p.id);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 1);
    nextPartyIdRef.current = highestPartyId + 1;
  };

  // Keeps the draft in sync as the user types — skipped while everything is still at its
  // pristine default so an untouched visit never writes an empty draft to storage.
  useEffect(() => {
    const isPristine =
      step === 1 &&
      !createdCaseId &&
      !formData.caseTitle.trim() &&
      !formData.jurisdiction.trim() &&
      !formData.ukJurisdiction.trim() &&
      !formData.clientSide &&
      formData.parties.every((p) => !p.name.trim());
    if (isPristine) return;
    // Typing into the fresh form while a draft is on offer means starting over.
    setPendingDraft(null);

    saveDraft({
      caseTitle: formData.caseTitle,
      jurisdiction: formData.jurisdiction,
      ukJurisdiction: formData.ukJurisdiction,
      parties: formData.parties,
      clientSide: formData.clientSide,
      step,
      maxStepReached,
      openTarget,
      createdCaseId,
    });
  }, [formData.caseTitle, formData.jurisdiction, formData.ukJurisdiction, formData.parties, formData.clientSide, step, maxStepReached, openTarget, createdCaseId]);

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
    focusPartyIdRef.current = id;
  };

  // Focus the party just added once it renders — which also scrolls it into view, since with
  // several parties it lands below the fold of the step card.
  const focusPartyIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = focusPartyIdRef.current;
    if (!id) return;
    focusPartyIdRef.current = null;
    document.getElementById(`party-name-${id}`)?.focus();
  }, [formData.parties]);

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

    const [supported, unsupported] = [
      incoming.filter(isAllowedFileType),
      incoming.filter((f) => !isAllowedFileType(f)),
    ];
    if (unsupported.length > 0) {
      toast.error(
        t("sectionEvidence.unsupportedFileType", {
          defaultValue: `${unsupported.map((f) => f.name).join(", ")} — unsupported file type, wasn't added. Supported formats: ${ALLOWED_FILE_TYPES_LABEL}.`,
          fileNames: unsupported.map((f) => f.name).join(", "),
          formats: ALLOWED_FILE_TYPES_LABEL,
        })
      );
    }

    const [withinSizeLimit, oversized] = [
      supported.filter((f) => f.size <= MAX_FILE_SIZE_BYTES),
      supported.filter((f) => f.size > MAX_FILE_SIZE_BYTES),
    ];
    if (oversized.length > 0) {
      toast.error(
        t("sectionEvidence.attachmentTooLarge", {
          defaultValue: `${oversized.map((f) => f.name).join(", ")} — over the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit per file, wasn't added.`,
          fileNames: oversized.map((f) => f.name).join(", "),
          maxMb: MAX_FILE_SIZE_BYTES / (1024 * 1024),
        })
      );
    }
    if (withinSizeLimit.length === 0) return;

    const entries: UploadedFile[] = withinSizeLimit.map((file) => ({
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
    stepEnteredAtRef.current = Date.now();
  };

  const handleStepBack = () => {
    if (step > 1) {
      setStep(step - 1);
      return;
    }
    // Leaving the wizard from step 1 is an explicit discard — don't resurrect this draft
    // if the user starts a new case later.
    clearDraft();
    router.push("/homepage/case-portfolio");
  };

  const handleSubmitFiling = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step !== 3) return;
    // See stepEnteredAtRef above — ignore a submit that fires immediately after arriving on
    // step 3, since that's a stray second click from advancing off step 2, not an intentional
    // file/submit click.
    if (Date.now() - stepEnteredAtRef.current < 400) return;
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
        // Free-text Jurisdiction has no home on the backend yet (see CONTEXT.md pending
        // section) — it's captured in the form but not sent. Parties go as an array, one entry
        // per party: the old joined `partyInvolved` string came back as a single party.
        const parties = formData.parties
          .filter((p) => p.name.trim())
          .map((p) => ({ name: p.name.trim(), designation: p.designation }));

        const newCase = await createCase({
          caseName: formData.caseTitle.trim(),
          parties: parties.length > 0 ? parties : undefined,
          ukJurisdiction: formData.ukJurisdiction || undefined,
          clientSide: formData.clientSide || undefined,
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

      clearDraft();
      router.push(
        openTarget === "terminal"
          ? `/homepage/terminal/${caseId}`
          : `/homepage/case-portfolio/${caseId}`,
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("submitFailed"));
    }
  };

  // A step only shows its tick once it's actually filled in — passing through step II with a
  // blank party used to tick it anyway.
  const stepComplete = (n: number) =>
    n === 1 ? !!formData.caseTitle.trim() : n === 2 ? partiesComplete(formData.parties) : false;
  const namedParties = formData.parties.filter((p) => p.name.trim());
  // A long party list collapses in the filing summary so it can't push the upload area off-screen;
  // the "+N more" toggle still lets every party be checked before filing.
  const partiesCollapsed = namedParties.length > SUMMARY_PARTY_LIMIT && !showAllParties;
  const summaryParties = partiesCollapsed ? namedParties.slice(0, SUMMARY_PARTY_LIMIT - 1) : namedParties;

  const steps = [
    { n: 1, numeral: t("steps.identity.numeral"), title: t("steps.identity.title"), hint: t("steps.identity.hint") },
    { n: 2, numeral: t("steps.parties.numeral"), title: t("steps.parties.title"), hint: t("steps.parties.hint") },
    { n: 3, numeral: t("steps.documents.numeral"), title: t("steps.documents.title"), hint: t("steps.documents.hint") },
  ];

  return (
    <PageShell>
      <form onSubmit={handleSubmitFiling} className="flex-1 flex flex-col">
        {/* md+ is pinned to the viewport height (no page-level scroll) — the back link and the
            grid below split that height via flex-1, and the step card scrolls internally as a
            fallback if its content doesn't fit. Below md this reverts to normal page flow, since
            a fixed-height layout fights the keyboard/viewport-resize behavior of mobile browsers. */}
        <div className="max-w-[1280px] w-full mx-auto px-6 md:px-12 pt-24 md:pt-20 pb-16 md:pb-8 flex flex-col gap-8 md:gap-4 md:h-screen">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage/case-portfolio"
                onClick={clearDraft}
                className="self-start shrink-0 flex items-center gap-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                {t("backToCases")}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Return to your case portfolio list</TooltipContent>
          </Tooltip>

          <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-5 md:gap-12 items-start md:items-stretch md:flex-1 md:min-h-0">
            <div className="flex flex-col gap-4 md:gap-7 md:sticky md:top-24 md:self-start">
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
                  const done = s.n < step && stepComplete(s.n);
                  const current = s.n === step;
                  const enabled = s.n <= maxStepReached;
                  return (
                    <li
                      key={s.n}
                      onClick={() => goToStep(s.n)}
                      className={`flex flex-1 flex-col items-center gap-1.5 text-center md:flex-none md:flex-row md:items-center md:gap-3.5 md:py-3.5 md:border-t md:border-border md:text-left ${enabled ? "cursor-pointer" : "cursor-default"}`}
                    >
                      {done ? (
                        <span className="w-6 h-6 md:w-6.5 md:h-6.5 rounded-full bg-brand-gold text-brand-gold-foreground flex items-center justify-center shrink-0">
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

            <div className="flex flex-col gap-5 min-w-0 md:min-h-0">
              {pendingDraft && (
                <div
                  role="status"
                  className="flex flex-col gap-3 rounded-xl border border-brand-gold/40 bg-brand-gold/5 px-4 py-3 sm:flex-row sm:items-center md:shrink-0"
                >
                  <p className="flex-1 text-sm text-foreground">
                    {pendingDraft.caseTitle.trim()
                      ? t("draftPrompt.withTitle", { title: pendingDraft.caseTitle.trim() })
                      : t("draftPrompt.untitled")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resumeDraft}
                      className="h-9 px-4 rounded-full bg-brand-gold text-brand-gold-foreground text-[10px] font-semibold tracking-[1.2px] uppercase hover:opacity-85 transition-opacity cursor-pointer"
                    >
                      {t("draftPrompt.resume")}
                    </button>
                    <button
                      type="button"
                      onClick={discardDraft}
                      className="h-9 px-4 rounded-full border border-border text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
                    >
                      {t("draftPrompt.startOver")}
                    </button>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300 rounded-xl px-4 py-3 md:shrink-0" role="alert">
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
                <section className="bg-card rounded-2xl border border-border p-5 sm:p-7 md:p-8 flex flex-col gap-7 md:min-h-0 md:overflow-y-auto">
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
                      maxLength={CASE_NAME_MAX_LENGTH}
                      onChange={(e) => handleInputChange("caseTitle", e.target.value)}
                      aria-invalid={caseTitleError}
                      aria-describedby={caseTitleError ? "caseTitle-error caseTitle-count" : "caseTitle-count"}
                    />
                    <CharCount id="caseTitle-count" length={formData.caseTitle.length} max={CASE_NAME_MAX_LENGTH} />
                    {caseTitleError && (
                      <p id="caseTitle-error" className="flex items-center gap-1.5 text-xs text-red-600">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        {t("sectionIdentity.caseTitleError")}
                      </p>
                    )}
                  </div>

                  {tenantConfig.ui.caseIntake.ukJurisdictionOptions.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      <label htmlFor="ukJurisdiction" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        {t("sectionIdentity.ukJurisdictionLabel")}
                      </label>
                      <CustomSelect
                        id="ukJurisdiction"
                        value={formData.ukJurisdiction}
                        onChange={(v) => handleInputChange("ukJurisdiction", v)}
                        options={tenantConfig.ui.caseIntake.ukJurisdictionOptions.map((v) => ({
                          value: v,
                          label: t(UK_JURISDICTION_LABEL_KEYS[v] ?? v),
                        }))}
                        placeholder={t("sectionIdentity.selectUkJurisdiction")}
                        triggerTooltip="Which UK jurisdiction's law, courts, and procedure apply to this case"
                      />
                    </div>
                  ) : (
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
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        {t("sectionIdentity.persistenceNotice")}
                      </p>
                    </div>
                  )}
                </section>
              )}

              {step === 2 && (
                <section className="bg-card rounded-2xl border border-border p-5 sm:p-7 md:p-8 flex flex-col gap-6 md:min-h-0 md:overflow-y-auto">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-brand-gold">
                      {t("steps.parties.numeral")}
                    </span>
                    <h2 className="font-['Libre_Caslon_Text'] text-lg sm:text-2xl font-normal text-foreground">{t("sectionParties.heading")}</h2>
                    <p className="text-[13px] text-muted-foreground">{t("sectionParties.subheading")}</p>
                  </div>

                  <div>
                    {/* No scroll box of its own: the step card already scrolls (md:overflow-y-auto
                        above), and a second, nested one beside it meant two scrollbars and a wheel
                        that moved whichever happened to be under the pointer (see ADR 0007). */}
                    <div className="flex flex-col gap-3.5">
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

                          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
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
                                maxLength={PARTY_NAME_MAX_LENGTH}
                                onChange={(e) => updateParty(party.id, "name", e.target.value)}
                                aria-describedby={`party-name-count-${party.id}`}
                              />
                              <CharCount id={`party-name-count-${party.id}`} length={party.name.length} max={PARTY_NAME_MAX_LENGTH} />
                            </div>

                            <DesignationPicker
                              name={`party-designation-${party.id}`}
                              legend={t("sectionParties.designationLabel")}
                              value={party.designation}
                              onChange={(v) => updateParty(party.id, "designation", v)}
                              options={DESIGNATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

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

                  <div className="flex flex-col gap-2 pt-5 border-t border-border">
                    <label htmlFor="clientSide" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      {t("sectionParties.clientSideLabel")}
                    </label>
                    <CustomSelect
                      id="clientSide"
                      value={formData.clientSide}
                      onChange={(v) => handleInputChange("clientSide", v)}
                      options={CLIENT_SIDE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                      triggerTooltip="Which side of the case you represent"
                    />
                    <p className="text-xs text-muted-foreground">{t("sectionParties.clientSideHint")}</p>
                  </div>
                </section>
              )}

              {step === 3 && (
                <section className="bg-card rounded-2xl border border-border p-5 sm:p-7 md:p-8 flex flex-col gap-6 md:min-h-0 md:overflow-y-auto">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-brand-gold">
                      {t("steps.documents.numeral")}
                    </span>
                    <h2 className="font-['Libre_Caslon_Text'] text-lg sm:text-2xl font-normal text-foreground">{t("sectionEvidence.heading")}</h2>
                    <p className="text-[13px] text-muted-foreground">{t("sectionEvidence.subheading")}</p>
                  </div>

                  {/* What's about to be filed — the title and parties aren't visible on this step
                      otherwise, and Initiate Filing creates the case. */}
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2 rounded-xl border border-border bg-background px-4 py-3 text-[13px]">
                    <dt className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{t("filingSummary.title")}</dt>
                    <dd className="font-['Libre_Caslon_Text'] text-foreground [overflow-wrap:anywhere]">{formData.caseTitle.trim()}</dd>
                    <button type="button" onClick={() => goToStep(1)} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer">
                      {t("filingSummary.edit")}
                    </button>
                    <dt className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{t("filingSummary.parties")}</dt>
                    {/* One party per line with its designation, so every name and side can be checked
                        before filing — a single joined line truncated everything after the first. */}
                    <dd className="text-foreground">
                      {namedParties.length > 0 ? (
                        <ul className="flex flex-col gap-1.5">
                          {summaryParties.map((p) => {
                            const option = DESIGNATION_OPTIONS.find((o) => o.value === p.designation);
                            return (
                              <li key={p.id} className="flex items-baseline justify-between gap-3">
                                <span className="min-w-0 [overflow-wrap:anywhere]">{p.name.trim()}</span>
                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                  {splitDesignationLabel(option ? t(option.labelKey) : p.designation)[0]}
                                </span>
                              </li>
                            );
                          })}
                          {namedParties.length > SUMMARY_PARTY_LIMIT && (
                            <li>
                              <button
                                type="button"
                                onClick={() => setShowAllParties((v) => !v)}
                                aria-expanded={!partiesCollapsed}
                                className="cursor-pointer text-[12px] font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
                              >
                                {partiesCollapsed
                                  ? t("filingSummary.moreParties", { count: namedParties.length - summaryParties.length })
                                  : t("filingSummary.fewerParties")}
                              </button>
                            </li>
                          )}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">{t("filingSummary.noParties")}</span>
                      )}
                    </dd>
                    <button type="button" onClick={() => goToStep(2)} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer">
                      {t("filingSummary.edit")}
                    </button>
                    <dt className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{t("filingSummary.clientSide")}</dt>
                    <dd className="truncate text-foreground">
                      {formData.clientSide
                        ? t(CLIENT_SIDE_OPTIONS.find((o) => o.value === formData.clientSide)!.labelKey)
                        : <span className="text-muted-foreground">{t("sectionParties.clientSideUnset")}</span>}
                    </dd>
                    <button type="button" onClick={() => goToStep(2)} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer">
                      {t("filingSummary.edit")}
                    </button>
                  </dl>

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
                      accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
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
                    <>
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        {t("sectionEvidence.attachedDossiers", { count: formData.uploadedFiles.length })}
                      </span>

                      {/* Bounded + scrollable instead of growing the page forever — a handful of
                          files fit with no scrollbar at all, more than that scrolls within this box. */}
                      <div className="flex flex-col border border-border rounded-xl overflow-y-auto max-h-72">
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
                    </>
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

              <div className={`flex items-center gap-4 md:shrink-0 ${step === 1 ? "justify-end sm:justify-between" : "justify-between"}`}>
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
                        className="flex items-center gap-2.5 h-11 sm:h-10 px-5 rounded-full bg-brand-gold text-brand-gold-foreground text-[10px] font-semibold tracking-[1.2px] uppercase hover:opacity-85 transition-opacity cursor-pointer"
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
                        className="flex items-center gap-2.5 h-11 sm:h-10 px-5 rounded-full bg-brand-gold text-brand-gold-foreground text-[10px] font-semibold tracking-[1.2px] uppercase hover:opacity-85 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
