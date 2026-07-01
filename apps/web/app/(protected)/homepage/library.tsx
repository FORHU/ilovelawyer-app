"use client";
import React, { useState } from "react";
import imgImage from "./495ff33a327fc891f656944b69cc3d57a2b4eefa.png";
import imgConstitutionalAndCivilCodes from "./34cb65b02263d702d8fdb46db8e648e7429ac8d7.png";

export default function LegalLibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    console.log("Querying AI Legal Model with snippet:", searchQuery);
    alert(`Searching legal matrix for: "${searchQuery}"`);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-gradient-to-b from-slate-50 to-blue-50/50 text-[#181c1e] font-['Inter',sans-serif]">
      
      {/* GLOBAL APPLICATION HEADER BAR */}
      <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 h-16 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-black tracking-tight">
              ilovelawyer
            </span>
            <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold tracking-wider text-gray-500">
              <a href="#platform" className="hover:text-black">PLATFORM</a>
              <a href="#solutions" className="hover:text-black">SOLUTIONS</a>
              <a href="#pricing" className="hover:text-black">PRICING</a>
            </nav>
          </div>
          <div className="flex gap-6 text-gray-400">
            <button className="hover:text-black">🔍</button>
            <button className="hover:text-black">👤</button>
          </div>
        </div>

        {/* JURIS NAV SUBBAR */}
        <div className="bg-[#0b132b] text-white backdrop-blur-[6px] border-b border-white/10">
          <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex items-center justify-center lg:justify-start gap-8 overflow-x-auto whitespace-nowrap text-[10px] tracking-widest font-medium py-4">
            <a href="#chat" className="opacity-70 hover:opacity-100 uppercase">AI CHAT</a>
            <a href="#case" className="opacity-70 hover:opacity-100 uppercase">CASE MANAGEMENT</a>
            <a href="#library" className="text-white border-b border-white pb-0.5 uppercase">LEGAL LIBRARY</a>
            <a href="#transcription" className="opacity-70 hover:opacity-100 uppercase">TRANSCRIPTION</a>
            <a href="#analysis" className="opacity-70 hover:opacity-100 uppercase">DOCUMENT ANALYSIS</a>
            <a href="#terms" className="opacity-70 hover:opacity-100 uppercase">STATUTORY TERMS</a>
          </div>
        </div>
      </header>

      {/* CORE WORKSPACE FRAMEWORK CONTAINER */}
      <main className="w-full flex flex-col flex-1">
        
        {/* HERO SEARCH SECTION WITH SPLIT EMBEDDED GRAPHIC */}
        <section className="relative bg-white border-b border-gray-200 overflow-hidden min-h-[500px] flex items-center">
          {/* Visual Side Anchor Graphic */}
          <div className="absolute inset-y-0 right-0 w-full lg:w-[55%] hidden lg:block pointer-events-none z-0">
            <img 
              alt="Legal archive background visualization" 
              className="w-full h-full object-cover opacity-90 mix-blend-multiply"
              src={imgImage.src} 
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent z-10" />
          </div>

          <div className="max-w-[1440px] w-full mx-auto px-6 md:px-16 py-16 relative z-20 flex">
            <div className="max-w-xl w-full border-l-2 border-black pl-8 flex flex-col gap-6">
              <h1 className="font-['Libre_Caslon_Text'] text-5xl md:text-6xl text-black font-normal leading-[1.1] tracking-tight">
                The Digital Archive of <span className="font-['Liberation_Serif'] italic block mt-1">Philippine Law.</span>
              </h1>

              {/* Functional Search Bar Wrapper Form */}
              <form onSubmit={handleSearch} className="w-full bg-white border border-black flex items-center p-1 shadow-xl">
                <span className="px-3 text-xl text-gray-400">📖</span>
                <input 
                  type="text"
                  className="flex-1 bg-transparent py-3 px-2 outline-none text-base text-gray-800 placeholder-gray-400"
                  placeholder="Codals, SCRA, or G.R. No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button 
                  type="submit"
                  className="bg-black text-white text-xs font-semibold tracking-wider px-6 py-4 hover:bg-slate-800 transition-colors"
                >
                  QUERY AI
                </button>
              </form>

              {/* Quick Navigation Helpers */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-gray-400 tracking-wider font-semibold">
                <span>QUICK ACCESS:</span>
                <a href="#rpc" className="text-gray-600 border-b border-gray-300 hover:text-black">REVISED PENAL CODE</a>
                <a href="#const" className="text-gray-600 border-b border-gray-300 hover:text-black">1987 CONSTITUTION</a>
                <a href="#rule130" className="text-gray-600 border-b border-gray-300 hover:text-black">RULE 130</a>
              </div>
            </div>
          </div>
        </section>

        {/* CLASSIFICATION SUMMARY CARDS SUB-GRID */}
        <section className="bg-slate-100 border-b border-gray-200 py-16">
          <div className="max-w-[1440px] mx-auto px-6 md:px-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* CARD 1: CODALS */}
            <div className="bg-white border border-gray-200 p-8 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center">
                <h3 className="font-['Libre_Caslon_Text'] text-lg text-black font-normal">Codals</h3>
                <span className="text-gray-400">⚖️</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">Statutory laws and legislative enactments.</p>
              <div className="mt-4 flex flex-col gap-2 text-xs text-blue-900 font-medium">
                <a href="#civil-code" className="hover:underline">→ Civil Code</a>
                <a href="#revised-penal-code" className="hover:underline">→ Revised Penal Code</a>
                <a href="#labor-code" className="hover:underline">→ Labor Code</a>
              </div>
            </div>

            {/* CARD 2: JURISPRUDENCE */}
            <div className="bg-white border border-gray-200 p-8 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center">
                <h3 className="font-['Libre_Caslon_Text'] text-lg text-black font-normal">Jurisprudence</h3>
                <span className="text-gray-400">🏛️</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">Supreme Court decisions and doctrines.</p>
              <div className="mt-4 flex flex-col gap-2 text-xs text-blue-900 font-medium">
                <a href="#scra" className="hover:underline">→ Supreme Court Reports</a>
                <a href="#gr-search" className="hover:underline">→ G.R. Search</a>
                <a href="#en-banc" className="hover:underline">→ En Banc Decisions</a>
              </div>
            </div>

            {/* CARD 3: TREATISES */}
            <div className="bg-white border border-gray-200 p-8 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center">
                <h3 className="font-['Libre_Caslon_Text'] text-lg text-black font-normal">Treatises</h3>
                <span className="text-gray-400">📚</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">Scholarly legal commentary and analysis.</p>
              <div className="mt-4 flex flex-col gap-2 text-xs text-blue-900 font-medium">
                <a href="#commentaries" className="hover:underline">→ Legal Commentaries</a>
                <a href="#journals" className="hover:underline">→ Law Journals</a>
                <a href="#bar-review" className="hover:underline">→ Bar Reviewers</a>
              </div>
            </div>

          </div>
        </section>

        {/* ROW EDITORIAL BENTO CONTAINER */}
        <section className="bg-white py-24">
          <div className="max-w-[1440px] mx-auto px-6 md:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            {/* LATERALLY SPLIT CARD A: STATUTES FEATURE */}
            <div className="flex flex-col gap-6">
              <div className="h-64 relative bg-slate-100 overflow-hidden group">
                <img 
                  alt="Constitutional and Civil Codes background graphic" 
                  className="w-full h-full object-cover mix-blend-overlay grayscale transition-transform duration-300 group-hover:scale-105" 
                  src={imgConstitutionalAndCivilCodes.src} 
                />
                <div className="absolute inset-0 bg-slate-900/10" />
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold tracking-widest text-amber-700 uppercase">STATUTES</span>
                <h2 className="font-['Libre_Caslon_Text'] text-2xl text-black">Constitutional &amp; Civil Codes</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Access the complete, annotated collection of Philippine laws. Our digital library maintains live updates for every legislative amendment.
                </p>
                <ul className="mt-2 flex flex-col gap-2 text-xs text-gray-800 font-normal pl-1">
                  <li className="flex items-center gap-3">
                    <span className="h-1 w-1 bg-black rounded-full" /> Civil Code of the Philippines
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1 w-1 bg-black rounded-full" /> Revised Penal Code
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1 w-1 bg-black rounded-full" /> Labor Code of the Philippines
                  </li>
                </ul>
              </div>
            </div>

            {/* LATERALLY SPLIT CARD B: JURISPRUDENCE BLOCK DEEP-DIVE */}
            <div className="flex flex-col gap-8">
              {/* Dark Rich Visual Action Anchor Panel */}
              <div className="bg-[#131a33] text-white p-8 flex flex-col justify-between h-64 relative overflow-hidden">
                <img 
                  alt="Dossier matrix context watermarked asset overlay" 
                  className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none" 
                  src={imgImage.src} 
                />
                <div className="relative z-10 flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-widest text-[#ffe088] uppercase">JURISPRUDENCE</span>
                  <h3 className="font-['Libre_Caslon_Text'] text-xl italic font-normal text-white">Supreme Court Reports</h3>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-sm mt-1">
                    Search over 100,000 full-text decisions. Use AI to extract key legal doctrines and cross-reference citations instantly.
                  </p>
                </div>
                <div className="relative z-10 flex items-end justify-between w-full border-t border-slate-700 pt-4">
                  <div>
                    <div className="font-['Libre_Caslon_Text'] text-2xl text-[#ffe088] font-normal">AI</div>
                    <div className="text-[9px] font-medium text-slate-400 tracking-wider uppercase">DOCTRINE EXTRACTION</div>
                  </div>
                  <button className="w-12 h-12 rounded-full border border-slate-500 hover:border-white flex items-center justify-center text-white transition-all">
                    ➔
                  </button>
                </div>
              </div>

              {/* Feed Listing of Recent Decisions */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-semibold tracking-wider text-gray-400 uppercase border-b pb-2">
                  RECENT DECISIONS
                </h4>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 tracking-wide font-medium">G.R. NO. 251000</span>
                    <span className="text-base font-bold text-gray-800">People vs. Dela Cruz</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 tracking-wide font-medium">G.R. NO. 248123</span>
                    <span className="text-base font-bold text-gray-800">Ayala Land vs. CIR</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 tracking-wide font-medium">G.R. NO. 260555</span>
                    <span className="text-base font-bold text-gray-800">Santos vs. Court of Appeals</span>
                  </div>
                </div>
              </div>
            </div>

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