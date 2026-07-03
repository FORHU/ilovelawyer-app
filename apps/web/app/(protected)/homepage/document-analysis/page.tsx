"use client";
import React, { useState } from "react";
import GlobalHeader from "@/components/global-header";

// --- Mock Initial Database Datasets ---
const initialAnalysisRecords = [
  { id: 1, name: "GR_No_210234_Final_Ruling.pdf", meta: "ANALYZED 2 HOURS AGO • RISK ASSESSMENT" },
  { id: 2, name: "Affidavit_of_Loss_Santamaria.docx", meta: "ANALYZED YESTERDAY • ENTITY EXTRACTION" },
  { id: 3, name: "NLRC_Case_Folder_09-B.pdf", meta: "ANALYZED 3 DAYS AGO • SUMMARIZATION" }
];

export default function IlovelawyerDocumentAnalysisDashboard() {
  const [records, setRecords] = useState(initialAnalysisRecords);
  const [dragActive, setDragActive] = useState(false);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      alert(`Successfully dropped: ${e.dataTransfer.files[0].name}`);
    }
  };

  const deleteRecord = (id: number) => {
    setRecords(records.filter(record => record.id !== id));
  };

  return (
    <div className="relative w-full min-h-screen bg-[#f7fafc] font-['Inter',sans-serif] flex flex-col justify-between">
      
      {/* Top Banner Branding Row */}
      <GlobalHeader activeTab="document-analysis" />

      {/* Main Grid Base Canvas Layout */}
      <main className="max-w-[1000px] mx-auto px-[48px] py-[85px] flex flex-col gap-[40px]">
        
        {/* Module Title Context */}
        <div className="w-full flex flex-col gap-2 border-b border-gray-200 pb-6">
          <div className="text-xs font-semibold tracking-widest text-gray-500 uppercase">SERVICE / MODULE</div>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[50px] text-[#131a33]">Document Analysis</h1>
          <p className="text-[#45464d] text-[18px] max-w-[672px] leading-[28.8px]">
            Utilize advanced neural processing to extract intelligence from complex legal filings. Upload any Philippine jurisprudence or statutory document for instant insight.
          </p>
        </div>


        {/* Drag and Drop Zone Container */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-[12px] p-[50px] transition-colors text-center backdrop-blur-[6px] ${
            dragActive ? "border-amber-500 bg-amber-50/20" : "border-[#76767e] bg-white/85"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-[#131a33] rounded-full flex items-center justify-center text-white text-2xl">
              📂
            </div>
            <div>
              <h3 className="font-['Libre_Caslon_Text',serif] text-[28px] text-[#181c1e] mb-1">Drag and drop your legal files here</h3>
              <p className="text-[#45464d] text-[12px] tracking-[1.2px] uppercase font-semibold">
                SUPPORTS PDF, DOCX (MAX 50MB)
              </p>
            </div>
            <label className="bg-black text-white px-[32px] py-[12px] text-[12px] font-semibold tracking-[1.2px] uppercase rounded cursor-pointer hover:bg-neutral-800 transition-colors mt-2">
              Select File
              <input type="file" className="hidden" onChange={(e) => e.target.files && e.target.files[0] && alert(`Selected: ${e.target.files[0].name}`)} />
            </label>
          </div>
        </div>

        {/* Bento Service Cards Subgrid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-[32px]">
          {[
            { title: "Summarization", desc: "Distill lengthy transcripts and court orders into executive summaries focusing on dispositive portions." },
            { title: "Entity Extraction", desc: "Automatically identify persons, properties, dates, and citation references within the document structure." },
            { title: "Risk Assessment", desc: "Pinpoint potential liabilities, missed deadlines, or conflicting clauses based on current Philippine law." }
          ].map((mod, index) => (
            <div key={index} className="bg-white/85 backdrop-blur-[6px] border border-[#c6c6ce] p-[33px] flex flex-col justify-between h-full">
              <div className="flex flex-col gap-4">
                <span className="text-xl">🛠️</span>
                <h3 className="font-['Libre_Caslon_Text',serif] text-[28px] text-[#181c1e]">{mod.title}</h3>
                <p className="text-[#45464d] text-[16px] leading-[25.6px]">{mod.desc}</p>
              </div>
              <button className="mt-8 self-start text-[12px] font-semibold tracking-[1.5px] border-b-2 border-black pb-2 hover:text-gray-700 hover:border-amber-700 transition-colors">
                LEARN MORE
              </button>
            </div>
          ))}
        </section>

        {/* Dynamic History Analysis Log Queue */}
        <section className="bg-white/85 border border-[#c6c6ce] rounded shadow-sm overflow-hidden">
          <div className="bg-[#f1f4f6]/50 px-[32px] py-[24px] flex justify-between items-center border-b border-[#c6c6ce]">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[28px] text-[#181c1e]">Recent Analysis</h2>
            <button className="text-[12px] font-semibold tracking-[1.2px] hover:underline">View All ➔</button>
          </div>
          
          <div className="flex flex-col">
            {records.map((record) => (
              <div key={record.id} className="flex justify-between items-center px-[32px] py-[16px] border-b border-[#c6c6ce] last:border-0 hover:bg-slate-50/80 transition-colors">
                <div className="flex gap-4 items-center">
                  <span className="text-2xl text-gray-500">📄</span>
                  <div>
                    <p className="font-medium text-[#181c1e] text-[16px]">{record.name}</p>
                    <p className="text-[#45464d] text-[10px] tracking-wider uppercase font-semibold mt-0.5">{record.meta}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button title="View Report" className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors">👁️</button>
                  <button title="Delete" onClick={() => deleteRecord(record.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors">🗑️</button>
                </div>
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