"use client";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import { useMediaQueueStore } from "@/lib/store/media-queue.store";
import { FolderUp, FileText, Trash2 } from "lucide-react";

type AnalysisRecord = { id: string; name: string; meta: string };

export default function IlovelawyerDocumentAnalysisDashboard() {
  const { t } = useTranslation("document-analysis");
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queuedDocuments = useMediaQueueStore((s) => s.documents);
  const queueDocument = useMediaQueueStore((s) => s.queueDocument);
  const removeQueuedDocument = useMediaQueueStore((s) => s.removeDocument);

  // Files attached from the consultation chat's paperclip button show up here first.
  const allRecords = [
    ...queuedDocuments.map((doc) => ({ id: doc.id, name: doc.name, meta: doc.meta })),
    ...records,
  ];

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
    if (queuedDocuments.some((doc) => doc.id === id)) {
      removeQueuedDocument(id);
    } else {
      setRecords(records.filter(record => record.id !== id));
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#f7fafc] font-['Inter',sans-serif] flex flex-col justify-between">

      {/* Top Banner Branding Row */}
      <GlobalHeader activeTab="document-analysis" />

      {/* Main Grid Base Canvas Layout */}
      <main className="max-w-[1000px] mx-auto px-6 sm:px-10 md:px-[48px] py-12 md:py-[85px] flex flex-col gap-8 md:gap-[40px]">

        {/* Module Title Context */}
        <div className="w-full flex flex-col gap-2 border-b border-gray-200 pb-6">
          <h1 className="font-['Libre_Caslon_Text',serif] text-[32px] sm:text-[40px] md:text-[50px] text-[#131a33]">{t("title")}</h1>
          <p className="text-[#45464d] text-[15px] md:text-[18px] max-w-[672px] leading-relaxed">
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
            dragActive ? "border-amber-500 bg-amber-50/40" : "border-gray-300 bg-white hover:border-gray-400"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-[#131a33] rounded-full flex items-center justify-center text-[#ffe088]">
              <FolderUp className="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-['Libre_Caslon_Text',serif] text-[22px] sm:text-[28px] text-[#181c1e] mb-1">{t("dropzone.heading")}</h3>
              <p className="text-[#45464d] text-[12px] tracking-[1.2px] uppercase font-semibold">
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
              className="bg-[#131a33] text-white px-[32px] py-[12px] text-[12px] font-semibold tracking-[1.2px] uppercase rounded-xl cursor-pointer hover:bg-[#1c2547] transition-colors mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/40 focus-visible:ring-offset-2"
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
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-[#f8fafc] px-4 sm:px-[32px] py-4 sm:py-[24px] border-b border-gray-200">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[24px] text-[#181c1e]">{t("recentAnalysis")}</h2>
          </div>

          <div className="flex flex-col">
            {allRecords.length === 0 && (
              <div className="px-4 sm:px-[32px] py-4 sm:py-[24px] text-[#45464d] text-[14px]">{t("noDocuments")}</div>
            )}
            {allRecords.map((record) => (
              <div key={record.id} className="flex justify-between items-center gap-3 px-4 sm:px-[32px] py-3 sm:py-[16px] border-b border-gray-200 last:border-0 hover:bg-slate-50 transition-colors">
                <div className="flex gap-4 items-center min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
                    <FileText className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[#181c1e] text-[16px] truncate">{record.name}</p>
                    <p className="text-[#45464d] text-[10px] tracking-wider uppercase font-semibold mt-0.5">{record.meta}</p>
                  </div>
                </div>
                <button
                  type="button"
                  title={t("delete")}
                  aria-label={t("deleteRecord", { name: record.name })}
                  onClick={() => deleteRecord(record.id)}
                  className="shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
