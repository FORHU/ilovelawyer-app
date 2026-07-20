"use client";
import React, { useRef, useState } from "react";
import GlobalHeader from "@/components/global-header";
import { useMediaQueueStore } from "@/lib/store/media-queue.store";
import { FolderUp, FileText, Trash2 } from "lucide-react";

type AnalysisRecord = { id: string; name: string; meta: string };

export default function IlovelawyerDocumentAnalysisDashboard() {
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
          <h1 className="font-['Libre_Caslon_Text',serif] text-[32px] sm:text-[40px] md:text-[50px] text-[#131a33]">Document Analysis</h1>
          <p className="text-[#45464d] text-[15px] md:text-[18px] max-w-[672px] leading-relaxed">
            Utilize advanced neural processing to extract intelligence from complex legal filings. Upload any Philippine jurisprudence or statutory document for instant insight.
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
              <h3 className="font-['Libre_Caslon_Text',serif] text-[22px] sm:text-[28px] text-[#181c1e] mb-1">Drag and drop your legal files here</h3>
              <p className="text-[#45464d] text-[12px] tracking-[1.2px] uppercase font-semibold">
                SUPPORTS PDF, DOCX (MAX 50MB)
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
              Select File
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
            <h2 className="font-['Libre_Caslon_Text',serif] text-[24px] text-[#181c1e]">Recent Analysis</h2>
          </div>

          <div className="flex flex-col">
            {allRecords.length === 0 && (
              <div className="px-4 sm:px-[32px] py-4 sm:py-[24px] text-[#45464d] text-[14px]">No documents analyzed yet.</div>
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
                  title="Delete"
                  aria-label={`Delete ${record.name}`}
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

      {/* SYSTEMATIC LEGAL FOOTER BLOCK */}
      <footer className="w-full bg-white border-t border-gray-200 py-16 relative z-10">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex flex-col lg:flex-row items-start justify-between gap-12">
          <div className="flex flex-col gap-4 max-w-sm">
            <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-black">
              ilovelawyer
            </span>
            <p className="text-sm text-gray-500 leading-relaxed font-normal">
              Dedicated to providing the legal community with the most advanced digital research tools in the Philippines.
            </p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-1">
              © 2026 ILOVELAWYER PHILIPPINES. ALL RIGHTS RESERVED.
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
              <a href="/homepage/term" className="hover:text-black font-normal">Privacy Policy</a>
              <a href="/homepage/term" className="hover:text-black font-normal">Terms of Use</a>
              <a href="/homepage/term" className="hover:text-black font-normal">Ethics Policy</a>
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
