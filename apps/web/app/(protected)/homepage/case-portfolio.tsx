"use client";
import React, { useState } from "react";
import Link from "next/link";

const [activeTab, setActiveTab] = useState("case"); // Default to "case" for this page
const initialCases = [
  {
    id: 1,
    title: "Cruz vs. Santos",
    docket: "G.R. No. 245123 • RTC Branch 12",
    category: "CIVIL CASE",
    metaLabel: "NEXT HEARING",
    metaValue: "Oct 24, 2024",
    statusText: "Updated 2h ago",
    badge: "URGENT",
  },
  {
    id: 2,
    title: "Estate of Lim",
    docket: "SP No. 998-M • Makati City",
    category: "FAMILY LAW",
    metaLabel: "STATUS",
    metaValue: "Discovery Phase",
    statusText: "Updated 1d ago",
    badge: null,
  },
  {
    id: 3,
    title: "Corpuz vs. Global Tech",
    docket: "NLRC NCR-01-00234-24",
    category: "LABOR RELATIONS",
    metaLabel: "ASSIGNED",
    metaValue: "Atty. Manuel",
    statusText: "Drafting Petition",
    badge: null,
    isSpineStyle: true, // Replicates Figma's gray background panel
  },
  {
    id: 4,
    title: "People vs. Aragon",
    docket: "Crim. Case 4501-A • QC RTC",
    category: "CRIMINAL LAW",
    metaLabel: "COURT DATE",
    metaValue: "Nov 12, 2024",
    statusText: "Updated 5h ago",
    badge: null,
  },
  {
    id: 5,
    title: "Vanguard Real Estate",
    docket: "Title Clearance & Audit",
    category: "COMMERCIAL",
    metaLabel: "ACTIVE DOCS",
    metaValue: "42 Transcripts",
    statusText: "AI Processing...",
    badge: null,
  }
];

export default function CaseManagerDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  // Get distinct categories dynamically for the filter dropdown
  const categories = ["All", ...new Set(initialCases.map(c => c.category))];

  // Search and Filter Logic
  const filteredCases = initialCases.filter((item) => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.docket.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === "All" || item.category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const handleNewFiling = () => {
    alert("Initiating a new case filing workflow...");
    // Inject your modal or routing pipeline here
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-slate-50 text-[#181c1e]">
      {/* Background Subtle Atmospheric Vectors */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" aria-hidden="true" />

      {/* Global Navigation Header Stack */}
      <header className="w-full bg-white border-b border-gray-200 relative z-20">
        {/* Top Tier */}
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 h-16 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <span className="font-['Libre_Caslon_Text'] text-28px text-black font-normal tracking-tight">
              ilovelawyer
            </span>
            <nav className="hidden md:flex items-center gap-8 text-[12px] font-semibold tracking-[1.2px] text-gray-500">
              <a href="#platform" className="hover:text-black transition-colors">PLATFORM</a>
              <a href="#solutions" className="hover:text-black transition-colors">SOLUTIONS</a>
              <a href="#pricing" className="hover:text-black transition-colors">PRICING</a>
            </nav>
          </div>
          <div className="flex gap-6 text-gray-400">
            <button className="hover:text-black">🔍</button>
            <button className="hover:text-black">👤</button>
          </div>
        </div>

        {/* Second Blur Tier Menu (Juris Navy) */}
        <div className="bg-[#0b132b] text-white backdrop-blur-[2px]">
         <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex items-center gap-8 overflow-x-auto whitespace-nowrap text-[12px] font-semibold tracking-[1.2px]">
  
  <Link 
    href="/homepage" // Maps to (protected)/homepage/page.tsx
    onClick={() => setActiveTab('consultation')}
    className={`py-4 tracking-[1.2px] transition-all ${
      activeTab === 'consultation' ? 'border-b-2 border-white font-bold' : 'opacity-70 hover:opacity-100'
    }`}
  >
    CONSULTATION
  </Link>

  <Link 
    href="/homepage/case-portfolio" // Maps to (protected)/homepage/case-portfolio folder
    onClick={() => setActiveTab('case')}
    className={`py-4 tracking-[1.2px] transition-all ${
      activeTab === 'case' ? 'border-b-2 border-white font-bold' : 'opacity-70 hover:opacity-100'
    }`}
  >
    CASE
  </Link>

  <button 
    onClick={() => setActiveTab('library')}
    className={`py-4 tracking-[1.2px] font-semibold text-[12px] transition-all ${
      activeTab === 'library' ? 'border-b-2 border-white font-bold' : 'opacity-70 hover:opacity-100'
    }`}
  >
    LIBRARY
  </button>

  <button 
    onClick={() => setActiveTab('transcription')}
    className={`py-4 tracking-[1.2px] font-semibold text-[12px] transition-all ${
      activeTab === 'transcription' ? 'border-b-2 border-white font-bold' : 'opacity-70 hover:opacity-100'
    }`}
  >
    TRANSCRIPTION
  </button>

  <button 
    onClick={() => setActiveTab('analysis')}
    className={`py-4 tracking-[1.2px] font-semibold text-[12px] transition-all ${
      activeTab === 'analysis' ? 'border-b-2 border-white font-bold' : 'opacity-70 hover:opacity-100'
    }`}
  >
    DOCUMENT ANALYSIS
  </button>

  <button 
    onClick={() => setActiveTab('terms')}
    className={`py-4 tracking-[1.2px] font-semibold text-[12px] transition-all ${
      activeTab === 'terms' ? 'border-b-2 border-white font-bold' : 'opacity-70 hover:opacity-100'
    }`}
  >
    STATUTORY TERMS
  </button>

</div>
        </div>
      </header>

      {/* Main Framework Dashboard Body */}
      <main className="max-w-[1440px] w-full mx-auto px-6 md:px-16 py-12 relative z-10 flex flex-col gap-12">
        
        {/* Page Titles */}
        <section>
          <h1 className="font-['Libre_Caslon_Text'] text-40px text-black font-normal leading-tight mb-1">
            Case Portfolio
          </h1>
          <p className="text-gray-500 text-[16px]">
            Managing {initialCases.length} active legal proceedings.
          </p>
        </section>

        {/* Filters and Controls Area */}
        <section className="flex flex-col md:flex-row items-center gap-6 justify-between w-full border-b border-gray-200 pb-6">
          {/* Active Filtering Text Input */}
          <div className="relative w-full md:max-w-xl flex items-center">
            <span className="absolute left-4 text-gray-400">🔍</span>
            <input
              type="text"
              className="w-full bg-white border border-gray-300 rounded-md py-3 pl-12 pr-4 outline-none font-['Inter'] text-[15px] shadow-sm focus:border-gray-400 transition-all"
              placeholder="Search by case name, docket number, or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Type Classification Selectors */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <label className="text-[12px] font-semibold tracking-[1.2px] text-gray-400 whitespace-nowrap uppercase">
              FILTER BY
            </label>
            <div className="relative bg-white border border-gray-300 rounded-md px-3 py-3 shadow-sm min-w-[160px]">
              <select
                className="w-full bg-transparent appearance-none outline-none text-[12px] font-semibold tracking-[1.2px] text-gray-800 cursor-pointer"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>Status: {cat}</option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</span>
            </div>
          </div>
        </section>

        {/* Dynamic Bento Card Grid Portfolio */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
          {filteredCases.map((c) => (
            <article
              key={c.id}
              className={`min-h-[300px] border border-gray-200 p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative ${
                c.isSpineStyle ? "bg-[#f1f4f6]" : "bg-white"
              }`}
            >
              {/* Card Title Header Section */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-6">
                  <span className="bg-[#e5e9eb] text-[#45464d] text-[11px] font-medium tracking-[1.2px] uppercase px-2 py-1 rounded-sm">
                    {c.category}
                  </span>
                  {/* Action Menu dot button placeholder */}
                  <button className="text-gray-300 hover:text-black">•••</button>
                </div>

                <h3 className="font-['Libre_Caslon_Text'] text-[26px] text-black font-normal leading-tight mb-2">
                  {c.title}
                </h3>
                <p className="text-gray-500 text-[14px] font-['Inter']">
                  {c.docket}
                </p>
              </div>

              {/* Card Meta Footer Block */}
              <div className="border-t border-gray-100 pt-6 mt-8 flex items-end justify-between">
                <div>
                  <span className="block text-gray-400 text-[10px] uppercase font-semibold tracking-wider mb-1">
                    {c.metaLabel}
                  </span>
                  <span className="text-[#181c1e] text-[14px] font-semibold">
                    {c.metaValue}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {c.badge && (
                    <span className="bg-[#ffe088] text-[#574500] text-[10px] font-bold px-2 py-1 rounded-sm tracking-wide">
                      {c.badge}
                    </span>
                  )}
                  <span className="text-gray-400 text-[12px] italic">
                    {c.statusText}
                  </span>
                </div>
              </div>
            </article>
          ))}

          {/* Interactive Dotted "Add New Filing" Placeholder State */}
          <button
            onClick={handleNewFiling}
            className="group min-h-[300px] border-2 border-dashed border-gray-300 bg-transparent hover:bg-white hover:border-gray-400 rounded-md flex flex-col items-center justify-center p-8 transition-all cursor-pointer"
          >
            <span className="text-3xl text-gray-300 group-hover:text-gray-500 transition-colors mb-3">
              ➕
            </span>
            <span className="text-[12px] font-semibold tracking-[1.2px] text-gray-400 group-hover:text-gray-700 transition-colors uppercase">
              INITIATE NEW FILING
            </span>
          </button>
        </section>
      </main>
    </div>
  );
}