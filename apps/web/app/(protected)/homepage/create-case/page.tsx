"use client";
import React, { useState, useRef } from "react";
import GlobalHeader from "@/components/global-header";

export default function CreateCasePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    caseTitle: "",
    actionType: "Civil Litigation",
    jurisdiction: "",
    partyName: "",
    designation: "Petitioner / Plaintiff",
    uploadedFiles: [] as File[],
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData((prev) => ({
      ...prev,
      uploadedFiles: [...(prev.uploadedFiles || []), ...files],
    }));
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSubmitFiling = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.caseTitle.trim()) {
      alert("Please specify a Case Title before initiating submission.");
      return;
    }
    console.log("Submitting Case Portfolio Dossier to AI Indexer:", formData);
    alert(`Filing initialized for: "${formData.caseTitle}"`);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-slate-50 text-[#181c1e] font-['Inter',sans-serif]">
      
      {/* GLOBAL HEADER BAR */}
      <header className="w-full bg-slate-100/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <GlobalHeader activeTab="create-case" />

        {/* JURIS NAV SUBBAR */}
        <div className="bg-[#131a33] text-white">
          <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex items-center justify-center lg:justify-start gap-8 overflow-x-auto whitespace-nowrap text-[10px] tracking-widest font-medium py-3">
            <a href="/homepage" className="text-gray-400 hover:text-white uppercase">CONSULTATION</a>
            <a href="/case" className="text-white border-b border-white pb-0.5 uppercase">CASE</a>
            <a href="/library" className="text-gray-400 hover:text-white uppercase">LIBRARY</a>
            <a href="/transcription" className="text-gray-400 hover:text-white uppercase">TRANSCRIPTION</a>
            <a href="/documents" className="text-gray-400 hover:text-white uppercase">DOCUMENTS</a>
            <a href="/terms" className="text-gray-400 hover:text-white uppercase">TERMS</a>
          </div>
        </div>
      </header>

      {/* CORE CANVAS WORKSPACE */}
      <form onSubmit={handleSubmitFiling} className="w-full flex flex-col flex-1">
        
        {/* PREMIUM VISUAL HERO BANNER */}
        <section className="relative h-[380px] md:h-[400px] bg-slate-700 overflow-hidden flex items-end">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-black/30 z-10" />
          <div className="max-w-[1024px] w-full mx-auto px-6 md:px-16 pb-48 relative z-20">

        {/* HERO BANNER */}
        <section className="relative h-95 md:h-120 bg-slate-900 overflow-hidden flex items-end">
          <div className="absolute inset-0 bg-linear-to-t from-slate-50 via-transparent to-black/30 z-10" />
          <div className="max-w-360 w-full mx-auto px-6 md:px-16 pb-16 relative z-20">
            <h1 className="font-['Libre_Caslon_Text'] text-5xl md:text-7xl text-white font-normal drop-shadow-md">
              Create Case
            </h1>
          </div>
        </section>

        {/* INTAKE FORM CONTAINER */}
        <section className="max-w-4xl w-full mx-auto px-6 md:px-12 -mt-8 relative z-30 pb-24">
          <div className="bg-white border border-gray-200 rounded-sm shadow-xl p-8 md:p-12 flex flex-col gap-12">

            {/* SECTION I: IDENTITY */}
            <fieldset className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <legend className="font-['Libre_Caslon_Text'] text-2xl text-[#181c1e] font-normal">
                  I. Case Identity
                </legend>
                <div className="bg-black h-px w-16" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <label className="text-[15px] font-bold tracking-wider text-gray-500 uppercase">
                    CASE TITLE / CAPTION
                  </label>
                  <input
                    type="text"
                    className="w-full bg-transparent border-b border-gray-400 py-2 outline-none font-['Libre_Caslon_Text'] text-xl focus:border-black transition-all"
                    placeholder="e.g. Cruz vs. Santos"
                    value={formData.caseTitle}
                    onChange={(e) => handleInputChange("caseTitle", e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[15px] font-bold tracking-wider text-gray-500 uppercase">
                    TYPE OF ACTION
                  </label>
                  <div className="relative border-b border-gray-300 py-2">
                    <select
                      className="w-full bg-transparent appearance-none outline-none text-base text-[#181c1e] cursor-pointer"
                      value={formData.actionType}
                      onChange={(e) => handleInputChange("actionType", e.target.value)}
                    >
                      <option value="Civil Litigation">Civil Litigation</option>
                      <option value="Criminal Proceeding">Criminal Proceeding</option>
                      <option value="Labor Dispute">Labor Dispute</option>
                      <option value="Commercial Arbitration">Commercial Arbitration</option>
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</span>
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-col gap-3">
                  <label className="text-[15px] font-bold tracking-wider text-gray-500 uppercase">
                    COURT / JURISDICTIONAL BRANCH
                  </label>
                  <input
                    type="text"
                    className="w-full bg-transparent border-b border-gray-400 py-2 outline-none font-['Libre_Caslon_Text'] text-xl focus:border-black transition-all"
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
                <legend className="font-['Libre_Caslon_Text'] text-2xl text-[#181c1e] font-normal">
                  II. Party Details
                </legend>
                <div className="bg-black h-px w-16" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <label className="text-[15px] font-bold tracking-wider text-gray-500 uppercase">
                    FULL NAME / CORPORATE ENTITY
                  </label>
                  <input
                    type="text"
                    className="w-full bg-transparent border-b border-gray-400 py-2 outline-none font-['Libre_Caslon_Text'] text-xl focus:border-black transition-all"
                    placeholder="Enter explicit legal identity name"
                    value={formData.partyName}
                    onChange={(e) => handleInputChange("partyName", e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[15px] font-bold tracking-wider text-gray-500 uppercase">
                    DESIGNATION
                  </label>
                  <div className="relative border-b border-gray-300 py-2">
                    <select
                      className="w-full bg-transparent appearance-none outline-none text-base text-[#181c1e] cursor-pointer"
                      value={formData.designation}
                      onChange={(e) => handleInputChange("designation", e.target.value)}
                    >
                      <option value="Petitioner / Plaintiff">Petitioner / Plaintiff</option>
                      <option value="Respondent / Defendant">Respondent / Defendant</option>
                      <option value="Intervenor / Third-Party">Intervenor / Third-Party</option>
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</span>
                  </div>
                </div>
              </div>
            </fieldset>

            {/* SECTION III: EVIDENTIARY SUBMISSIONS */}
            <fieldset className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <legend className="font-['Libre_Caslon_Text'] text-2xl text-[#181c1e] font-normal">
                  III. Evidentiary Submissions
                </legend>
                <div className="bg-black h-px w-16" />
              </div>

              <div className="border border-gray-200 bg-slate-50 rounded-sm p-8 flex flex-col items-center justify-center text-center gap-4 relative">
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                />

                <div className="text-4xl text-gray-300 opacity-70">📁</div>

                <div>
                  <h4 className="font-['Libre_Caslon_Text'] text-xl text-[#181c1e] mb-1">
                    Deposit Case Files
                  </h4>
                  <p className="text-gray-500 text-sm italic font-light">
                    PDF or DOCX standard for automated indexing
                  </p>
                </div>

                <button
                  type="button"
                  onClick={triggerFileSelect}
                  className="bg-black text-white text-xs font-semibold tracking-wider px-6 py-3 rounded-xl hover:bg-slate-800 transition-all uppercase"
                >
                  SELECT DOCUMENTS
                </button>

                {formData.uploadedFiles.length > 0 && (
                  <div className="w-full max-w-md mt-4 text-left bg-white border border-gray-200 p-4 text-xs text-gray-700 flex flex-col gap-1 max-h-32 overflow-y-auto">
                    <p className="font-bold border-b pb-1 mb-1 text-gray-500">ATTACHED DOSSIERS ({formData.uploadedFiles.length}):</p>
                    {formData.uploadedFiles.map((f, i) => (
                      <div key={i} className="truncate">📄 {f.name} ({(f.size / 1024).toFixed(1)} KB)</div>
                    ))}
                  </div>
                )}
              </div>
            </fieldset>

            <div className="border-t border-gray-200 pt-8 mt-4 flex justify-start">
              <button
                type="submit"
                className="bg-black text-white rounded-xl font-medium tracking-widest text-base px-10 py-4 hover:bg-slate-800 transition-colors uppercase"
              >
                INITIATE FILING
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
