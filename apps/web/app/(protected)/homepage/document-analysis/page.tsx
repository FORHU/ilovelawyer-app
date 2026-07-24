"use client";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import CustomSelect from "@/components/ui/custom-select";
import { useMediaQueueStore, type QueuedDocument } from "@/lib/store/media-queue.store";
import { useCasesQuery, useUploadCaseDocumentMutation } from "@/lib/cases/mutations";
import { FolderUp, FileText, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type SendStatus = "idle" | "sending" | "sent" | "error";
interface SendState {
  caseId: string;
  status: SendStatus;
  error?: string;
}

export default function IlovelawyerDocumentAnalysisDashboard() {
  const { t } = useTranslation("document-analysis");
  const [dragActive, setDragActive] = useState(false);
  const [sendStateById, setSendStateById] = useState<Record<string, SendState>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queuedDocuments = useMediaQueueStore((s) => s.documents);
  const queueDocument = useMediaQueueStore((s) => s.queueDocument);
  const removeQueuedDocument = useMediaQueueStore((s) => s.removeDocument);

  const { data: casesData } = useCasesQuery();
  const { mutateAsync: uploadDocument } = useUploadCaseDocumentMutation();
  const caseOptions = [
    { value: "", label: t("noCaseOption") },
    ...(casesData?.data ?? []).map((c) => ({ value: c.id, label: c.caseName })),
  ];

  const getSendState = (id: string): SendState => sendStateById[id] ?? { caseId: "", status: "idle" };
  const updateSendState = (id: string, patch: Partial<SendState>) => {
    setSendStateById((prev) => ({ ...prev, [id]: { ...getSendState(id), ...patch } }));
  };

  const queueFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => queueDocument(file));
  };

  // Drag handlers
  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    queueFiles(e.dataTransfer.files);
  };

  const deleteRecord = (id: string) => {
    removeQueuedDocument(id);
  };

  const handleSend = async (doc: QueuedDocument) => {
    const state = getSendState(doc.id);
    updateSendState(doc.id, { status: "sending", error: undefined });
    try {
      await uploadDocument({ file: doc.file, caseId: state.caseId || undefined });
      updateSendState(doc.id, { status: "sent" });
    } catch (err) {
      updateSendState(doc.id, {
        status: "error",
        error: err instanceof Error ? err.message : t("sendFailed"),
      });
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-background text-foreground font-['Inter',sans-serif] flex flex-col justify-between">

      {/* Top Banner Branding Row */}
      <GlobalHeader activeTab="document-analysis" />

      {/* Main Grid Base Canvas Layout */}
      <main className="max-w-[1000px] mx-auto px-6 sm:px-10 md:px-[48px] py-12 md:py-[85px] flex flex-col gap-8 md:gap-[40px]">

        {/* Module Title Context */}
        <div className="w-full flex flex-col gap-2 border-b border-border pb-6">
          <h1 className="font-['Libre_Caslon_Text',serif] text-[32px] sm:text-[40px] md:text-[50px] text-primary">{t("title")}</h1>
          <p className="text-muted-foreground text-[15px] md:text-[18px] max-w-[672px] leading-relaxed">
            {t("subtitle")}
          </p>
        </div>


        {/* Drag and Drop Zone Container */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-[50px] transition-colors text-center ${
            dragActive ? "border-amber-500 bg-amber-50/40 dark:border-amber-400 dark:bg-amber-500/10" : "border-border bg-card hover:border-foreground/30"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-brand-navy-900 rounded-full flex items-center justify-center text-brand-gold">
              <FolderUp className="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-['Libre_Caslon_Text',serif] text-[22px] sm:text-[28px] text-foreground mb-1">{t("dropzone.heading")}</h3>
              <p className="text-muted-foreground text-[12px] tracking-[1.2px] uppercase font-semibold">
                {t("dropzone.supports")}
              </p>
            </div>
            <label
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="bg-brand-navy-900 text-white px-[32px] py-[12px] text-[12px] font-semibold tracking-[1.2px] uppercase rounded-xl cursor-pointer hover:bg-brand-navy-800 transition-colors mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2"
            >
              {t("dropzone.selectFile")}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  queueFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {/* Dynamic History Analysis Log Queue */}
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="bg-muted px-4 sm:px-[32px] py-4 sm:py-[24px] border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[24px] text-foreground">{t("recentAnalysis")}</h2>
          </div>

          <div className="flex flex-col">
            {queuedDocuments.length === 0 && (
              <div className="px-4 sm:px-[32px] py-4 sm:py-[24px] text-muted-foreground text-[14px]">{t("noDocuments")}</div>
            )}
            {queuedDocuments.map((record) => {
              const sendState = getSendState(record.id);
              const selectedCase = caseOptions.find((c) => c.value === sendState.caseId);
              return (
                <div key={record.id} className="flex flex-col gap-3 px-4 sm:px-[32px] py-3 sm:py-[16px] border-b border-border last:border-0 hover:bg-muted transition-colors">
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex gap-4 items-center min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                        <FileText className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-[16px] truncate">{record.name}</p>
                        <p className="text-muted-foreground text-[10px] tracking-wider uppercase font-semibold mt-0.5">{record.meta}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      title={t("delete")}
                      aria-label={t("deleteRecord", { name: record.name })}
                      onClick={() => deleteRecord(record.id)}
                      className="shrink-0 p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {sendState.status === "sent" ? (
                    <div className="flex flex-col gap-1 pl-14">
                      <p className="flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        {selectedCase && selectedCase.value
                          ? t("sentToCase", { caseName: selectedCase.label })
                          : t("sentNoCase")}
                      </p>
                      <p className="text-[12px] text-muted-foreground italic">{t("analysisComingSoon")}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pl-0 sm:pl-14">
                      <CustomSelect
                        value={sendState.caseId}
                        onChange={(v) => updateSendState(record.id, { caseId: v })}
                        options={caseOptions}
                        placeholder={t("attachToCase")}
                        className="w-full sm:w-64"
                      />
                      <button
                        type="button"
                        onClick={() => handleSend(record)}
                        disabled={sendState.status === "sending"}
                        className="inline-flex items-center justify-center gap-1.5 bg-brand-navy-900 text-white text-[12px] font-semibold tracking-wider px-4 py-2 rounded-lg hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendState.status === "sending" && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                        {sendState.status === "sending" ? t("sending") : sendState.status === "error" ? t("retry") : t("send")}
                      </button>
                      {sendState.status === "error" && sendState.error && (
                        <p className="flex items-center gap-1.5 text-[12px] text-red-600 dark:text-red-400">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          {sendState.error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

    </div>
  );
}
