"use client";
import React, { useState, useEffect, useRef } from "react";
import GlobalHeader from "@/components/global-header";
import CustomSelect from "@/components/ui/custom-select";
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle, Plus, RotateCw } from "lucide-react";
import {
  useCreateCaseMutation,
  useCreateDocumentUploadUrlMutation,
  uploadFileToS3,
} from "@/lib/cases/mutations";

const ACTION_TYPE_OPTIONS = [
  { value: "Civil Litigation", label: "Civil Litigations" },
  { value: "Criminal Proceeding", label: "Criminal Proceeding" },
  { value: "Labor Dispute", label: "Labor Dispute" },
  { value: "Commercial Arbitration", label: "Commercial Arbitration" },
];

const DESIGNATION_OPTIONS = [
  { value: "Petitioner / Plaintiff", label: "Petitioner / Plaintiff" },
  { value: "Respondent / Defendant", label: "Respondent / Defendant" },
  { value: "Intervenor / Third-Party", label: "Intervenor / Third-Party" },
];

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
  progress: number;
  key?: string;
  error?: string;
}


export default function CreateCasePage() {
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

  const { mutateAsync: getUploadUrl } = useCreateDocumentUploadUrlMutation();
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
      if (target?.name.trim() && !window.confirm(`Remove "${target.name}" from Party Details? This can't be undone.`)) {
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

  // Uploads straight to S3 via a presigned URL fetched from the backend —
  // the file never passes through our own API server.
  const uploadOne = async (entry: UploadedFile) => {
    try {
      const { uploadUrl, key } = await getUploadUrl({
        fileName: entry.file.name,
        fileType: entry.file.type,
        fileSize: entry.file.size,
      });
      await uploadFileToS3(uploadUrl, entry.file, (progress) => updateUploadedFile(entry.id, { progress }));
      updateUploadedFile(entry.id, { status: "uploaded", progress: 100, key });
    } catch (err) {
      updateUploadedFile(entry.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed",
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
      progress: 0,
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
    updateUploadedFile(id, { status: "uploading", progress: 0, error: undefined });
    void uploadOne({ ...entry, status: "uploading", progress: 0, error: undefined });
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
      await createCase({
        caseTitle: formData.caseTitle,
        actionType: formData.actionType,
        jurisdiction: formData.jurisdiction,
        parties: formData.parties.map(({ name, designation }) => ({ name, designation })),
        documents: formData.uploadedFiles
          .filter((f): f is UploadedFile & { key: string } => f.status === "uploaded" && !!f.key)
          .map((f) => ({ key: f.key, fileName: f.file.name })),
      });
      setSubmittedTitle(formData.caseTitle);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit case filing.");
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-slate-50 text-[#181c1e] font-['Inter',sans-serif]">

      <GlobalHeader activeTab="create-case" />

      {/* CORE CANVAS WORKSPACE */}
      <form onSubmit={handleSubmitFiling} className="w-full flex flex-col flex-1">

        {/* HERO BACKDROP */}
        <section className="relative h-48 bg-slate-900 overflow-hidden" />

        {/* INTAKE FORM CONTAINER */}
        <section className="max-w-4xl w-full mx-auto px-6 md:px-12 -mt-16 relative pt-8 z-30 pb-8">

          <div className="bg-white border border-gray-200 rounded-sm shadow-xl p-8 md:p-12 flex flex-col gap-12 font-['Inter']">
            <h1 className="font-['Libre_Caslon_Text'] text-2xl text-black font-normal tracking-[-1.2px] -mb-6">
              Create Case
            </h1>

            {submittedTitle && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-sm px-4 py-3 -mb-6" role="status">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">
                  Filing initialized for <span className="font-semibold">&ldquo;{submittedTitle}&rdquo;</span>.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmittedTitle(null)}
                  className="ml-auto text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  aria-label="Dismiss confirmation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {submitError && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-sm px-4 py-3 -mb-6" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">{submitError}</p>
                <button
                  type="button"
                  onClick={() => setSubmitError(null)}
                  className="ml-auto text-red-700 hover:text-red-900 cursor-pointer"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* SECTION I: IDENTITY */}
            <fieldset className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">

                <legend className="font-['Libre_Caslon_Text'] text-lg text-[#181c1e] font-normal">
                  I. Case Identity
                </legend>
                <div className="bg-black h-px w-16" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <label htmlFor="caseTitle" className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                    CASE TITLE / CAPTION <span className="text-gray-400 normal-case font-normal">(required)</span>
                  </label>
                  <input
                    id="caseTitle"
                    type="text"
                    className={`w-full bg-transparent border-b py-2 outline-none text-sm transition-colors ${
                      caseTitleError ? "border-red-500" : "border-gray-400 focus:border-black"
                    }`}
                    placeholder="e.g. Cruz vs. Santos"
                    value={formData.caseTitle}
                    onChange={(e) => handleInputChange("caseTitle", e.target.value)}
                    aria-invalid={caseTitleError}
                    aria-describedby={caseTitleError ? "caseTitle-error" : undefined}
                  />
                  {caseTitleError && (
                    <p id="caseTitle-error" className="flex items-center gap-1.5 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      Please specify a case title before initiating submission.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <label htmlFor="actionType" className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                    TYPE OF ACTION
                  </label>
                  <CustomSelect
                    id="actionType"
                    value={formData.actionType}
                    onChange={(v) => handleInputChange("actionType", v)}
                    options={ACTION_TYPE_OPTIONS}
                    placeholder="Select action"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-3">
                  <label htmlFor="jurisdiction" className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                    COURT / JURISDICTIONAL BRANCH
                  </label>
                  <input
                    id="jurisdiction"
                    type="text"
                    className="w-full bg-transparent border-b border-gray-400 py-2 outline-none text-sm focus:border-black transition-all"
                    placeholder="e.g. RTC Branch 12, Makati City"
                    value={formData.jurisdiction}
                    onChange={(e) => handleInputChange("jurisdiction", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            {/* SECTION II: PARTY DETAILS */}
            <fieldset className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <legend className="font-['Libre_Caslon_Text'] text-lg text-[#181c1e] font-normal">
                  II. Party Details
                </legend>
                <div className="bg-black h-px w-16" />
              </div>

              <div className="relative">
                {/* Bounded + scrollable instead of growing the page forever: 1-3 parties
                    fit with no scrollbar at all, more than that scrolls within this box. */}
                <div className="flex flex-col gap-4 max-h-105 overflow-y-auto pr-1 -mr-1">
                  {formData.parties.map((party, index) => (
                    <div key={party.id} className="border border-gray-200 rounded-sm p-5 flex flex-col gap-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                          Party {index + 1}
                        </span>
                        {formData.parties.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParty(party.id)}
                            className="text-gray-400 hover:text-red-600 cursor-pointer"
                            aria-label={`Remove party ${index + 1}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-3">
                          <label htmlFor={`party-name-${party.id}`} className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                            FULL NAME / CORPORATE ENTITY
                          </label>
                          <input
                            id={`party-name-${party.id}`}
                            type="text"
                            className="w-full bg-transparent border-b border-gray-400 py-2 outline-none text-sm focus:border-black transition-all"
                            placeholder="Enter explicit legal identity name"
                            value={party.name}
                            onChange={(e) => updateParty(party.id, "name", e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col gap-3">
                          <label htmlFor={`party-designation-${party.id}`} className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                            DESIGNATION
                          </label>
                          <CustomSelect
                            id={`party-designation-${party.id}`}
                            value={party.designation}
                            onChange={(v) => updateParty(party.id, "designation", v)}
                            options={DESIGNATION_OPTIONS}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {formData.parties.length > 3 && (
                  <div className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-linear-to-t from-white to-transparent" />
                )}
              </div>

              <button
                type="button"
                onClick={addParty}
                className="self-start flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-600 hover:text-black hover:border-gray-400 border border-dashed border-gray-300 rounded-full px-4 py-2.5 uppercase transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Party
              </button>
            </fieldset>

            {/* SECTION III: EVIDENTIARY SUBMISSIONS */}
            <fieldset className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <legend className="font-['Libre_Caslon_Text'] text-lg text-[#181c1e] font-normal">
                  III. Evidentiary Submissions
                </legend>
                <div className="bg-black h-px w-16" />
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && triggerFileSelect()}
                className={`border border-dashed rounded-sm p-8 flex flex-col items-center justify-center text-center gap-4 relative cursor-pointer transition-colors ${
                  isDragActive ? "border-black bg-slate-100" : "border-gray-300 bg-slate-50 hover:border-gray-400"
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

                <UploadCloud className="w-9 h-9 text-gray-300" strokeWidth={1.5} aria-hidden="true" />

                <div>
                  <h4 className="font-['Libre_Caslon_Text'] text-lg text-[#181c1e] mb-1">
                    Deposit Case Files
                  </h4>
                  <p className="text-gray-500 text-sm italic font-light">
                    Drag & drop, or browse. PDF or DOCX standard for automated indexing
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileSelect();
                  }}
                  className="bg-black text-white text-xs font-semibold tracking-wider px-6 py-3.5 rounded-xl hover:bg-slate-800 transition-all uppercase cursor-pointer"
                >
                  SELECT DOCUMENTS
                </button>

                {formData.uploadedFiles.length > 0 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md mt-4 text-left bg-white border border-gray-200 p-4 text-xs text-gray-700 flex flex-col gap-2 max-h-40 overflow-y-auto"
                  >
                    <p className="font-bold border-b pb-1 mb-1 text-gray-500">ATTACHED DOSSIERS ({formData.uploadedFiles.length}):</p>
                    {formData.uploadedFiles.map((f) => (
                      <div key={f.id} className="flex flex-col gap-1 py-0.5">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden="true" />
                          <span className="truncate flex-1">{f.file.name} ({(f.file.size / 1024).toFixed(1)} KB)</span>
                          {f.status === "uploading" && (
                            <span className="text-gray-400 shrink-0">{f.progress}%</span>
                          )}
                          {f.status === "uploaded" && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                          )}
                          {f.status === "error" && (
                            <button
                              type="button"
                              onClick={() => retryUpload(f.id)}
                              className="flex items-center gap-1 text-red-600 hover:text-red-800 cursor-pointer shrink-0"
                              aria-label={`Retry uploading ${f.file.name}`}
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(f.id)}
                            className="text-gray-400 hover:text-red-600 cursor-pointer shrink-0"
                            aria-label={`Remove ${f.file.name}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {f.status === "uploading" && (
                          <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-black transition-all"
                              style={{ width: `${f.progress}%` }}
                            />
                          </div>
                        )}
                        {f.status === "error" && (
                          <p className="text-red-600">{f.error ?? "Upload failed."}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </fieldset>

            <div className="border-t border-gray-200 pt-8 mt-4 flex justify-start">
              <button
                type="submit"
                disabled={hasFilesUploading || hasFailedUploads || isSubmitting}
                className="bg-black text-white rounded-xl font-medium tracking-widest text-sm px-10 py-4 hover:bg-slate-800 transition-colors uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "SUBMITTING…" : "INITIATE FILING"}
              </button>
            </div>

          </div>
        </section>
      </form>

      <footer className="w-full bg-[#f7fafc] border-t border-gray-200 py-16 relative z-10">
        <div className="max-w-360 mx-auto px-6 md:px-16 flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="flex flex-col gap-4 max-w-sm">
            <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-black">
              ilovelawyer
            </span>
            <p className="text-sm text-gray-500 leading-relaxed font-normal">
              Dedicated to providing the legal community with the most advanced digital research tools in the Philippines.
            </p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">
              © 2024 ILOVELAWYER PHILIPPINES. ALL RIGHTS RESERVED.
            </p>
          </div>

          <div className="flex gap-x-16 gap-y-8 flex-wrap text-xs font-semibold text-gray-500">
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-black tracking-wider uppercase text-[11px]">RESEARCH</span>
              <a href="#const" className="hover:text-black font-normal">Constitution</a>
              <a href="#civil" className="hover:text-black font-normal">Civil Code</a>
              <a href="#scra" className="hover:text-black font-normal">SCRA Archive</a>
            </div>
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-black tracking-wider uppercase text-[11px]">LEGAL</span>
              <a href="#privacy" className="hover:text-black font-normal">Privacy Policy</a>
              <a href="#terms" className="hover:text-black font-normal">Terms of Use</a>
              <a href="#ethics" className="hover:text-black font-normal">Ethics Policy</a>
            </div>
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-black tracking-wider uppercase text-[11px]">CONNECT</span>
              <a href="#support" className="hover:text-black font-normal">Support Center</a>
              <a href="#media" className="hover:text-black font-normal">Media Inquiries</a>
              <a href="#contact" className="hover:text-black font-normal">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
