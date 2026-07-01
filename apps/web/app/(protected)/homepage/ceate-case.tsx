"use client";
import React, { useState, useRef } from "react";
import imgPremiumLawOfficeInterior from "./66839da33c2ab42b575f3a0724991d3ca20d11e7.png";

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

  const handleInputChange = (field:string, value:any) => {
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
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 h-16 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-black tracking-tight">
              ilovelawyer
            </span>
            <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-gray-600">
              <a href="#platform" className="text-black border-b-2 border-black pb-1">PLATFORM</a>
              <a href="#solutions" className="hover:text-black">SOLUTIONS</a>
              <a href="#pricing" className="hover:text-black">PRICING</a>
              <a href="#case" className="hover:text-black">CASE MANAGEMENT</a>
              <a href="#library" className="hover:text-black">LEGAL LIBRARY</a>
            </nav>
          </div>
          <div className="flex gap-6 text-gray-500">
            <button className="hover:text-black">🔍</button>
            <button className="hover:text-black">👤</button>
          </div>
        </div>

        {/* JURIS NAV SUBBAR */}
        <div className="bg-[#131a33] text-white">
          <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex items-center justify-center lg:justify-start gap-8 overflow-x-auto whitespace-nowrap text-[10px] tracking-widest font-medium py-3">
            <a href="#chat" className="text-gray-400 hover:text-white uppercase">AI CHAT</a>
            <a href="#case" className="text-white border-b border-white pb-0.5 uppercase">CASE</a>
            <a href="#library" className="text-gray-400 hover:text-white uppercase">LEGAL LIBRARY</a>
            <a href="#transcription" className="text-gray-400 hover:text-white uppercase">TRANSCRIPTION</a>
            <a href="#analysis" className="text-gray-400 hover:text-white uppercase">DOCUMENT ANALYSIS</a>
            <a href="#terms" className="text-gray-400 hover:text-white uppercase">STATUTORY TERMS</a>
          </div>
        </div>
      </header>

      {/* CORE CANVAS WORKSPACE */}
      <form onSubmit={handleSubmitFiling} className="w-full flex flex-col flex-1">
        
        {/* PREMIUM VISUAL HERO BANNER */}
        <section className="relative h-[380px] md:h-[480px] bg-slate-900 overflow-hidden flex items-end">
          <img 
            alt="Premium law office interior background" 
            className="absolute inset-0 w-full h-full object-cover object-center opacity-40 mix-blend-luminosity scale-105"
            src={imgPremiumLawOfficeInterior.src} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-black/30 z-10" />
          <div className="max-w-[1440px] w-full mx-auto px-6 md:px-16 pb-16 relative z-20">
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
                <div className="bg-black h-[1px] w-16" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
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
                  <label className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
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
                  <label className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
                    COURT / JURISDICTIONAL BRANCH
                  </label>
                  <input 
                    type="text"
                    className="w-full bg-transparent border-b border-gray-400 py-2 outline-none text-base focus:border-black transition-all"
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
                <div className="bg-black h-[1px] w-16" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
                    FULL NAME / CORPORATE ENTITY
                  </label>
                  <input 
                    type="text"
                    className="w-full bg-transparent border-b border-gray-400 py-2 outline-none text-base focus:border-black transition-all"
                    placeholder="Enter explicit legal identity name"
                    value={formData.partyName}
                    onChange={(e) => handleInputChange("partyName", e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
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
                <div className="bg-black h-[1px] w-16" />
              </div>

              {/* Dynamic Interactive File Attachment Dropzone */}
              <div className="border border-gray-200 bg-slate-50 rounded-sm p-8 flex flex-col items-center justify-center text-center gap-4 relative">
                <input 
                  type="file" 
                  multiple 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                />
                
                {/* SVG Icon Container Asset Graphic */}
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
                  className="bg-black text-white text-xs font-semibold tracking-wider px-6 py-3 rounded-none hover:bg-slate-800 transition-all uppercase"
                >
                  SELECT DOCUMENTS
                </button>

                {/* Display list of uploaded items if present */}
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

            {/* ACTION FOOTER BAR SUBMISSION LAYER */}
            <div className="border-t border-gray-200 pt-8 mt-4 flex justify-start">
              <button
                type="submit"
                className="bg-black text-white font-medium tracking-widest text-base px-10 py-4 hover:bg-slate-800 transition-colors uppercase"
              >
                INITIATE FILING
              </button>
            </div>

          </div>
        </section>
      </form>

      {/* SYSTEM SYSTEMIC FOOTER */}
      <footer className="w-full bg-[#f7fafc] border-t border-gray-200 py-16 relative z-10">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="flex flex-col gap-4 max-w-sm">
            <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-black">
              ilovelawyer
            </span>
            <p className="text-[11px] font-semibold tracking-widest text-gray-500 uppercase leading-relaxed">
              © 2024 ILOVELAWYER PHILIPPINES.<br />
              PROFESSIONAL LEGAL ARTIFICIAL INTELLIGENCE &amp; EDITORIAL SYSTEMS.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-[12px] font-semibold tracking-wider text-gray-500">
            <a href="#privacy" className="hover:text-black uppercase">PRIVACY ARCHIVE</a>
            <a href="#governance" className="hover:text-black uppercase">GOVERNANCE TERMS</a>
            <a href="#compliance" className="hover:text-black uppercase">BAR COMPLIANCE</a>
            <a href="#concierge" className="hover:text-black uppercase">CONCIERGE</a>
          </div>
        </div>
      </footer>

    </div>
  );
}