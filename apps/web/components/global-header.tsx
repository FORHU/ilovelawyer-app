// apps/web/components/global-header.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface GlobalHeaderProps {
  // Enforces passing one of your exact six workspace pages
  activeTab: "consultation" | "create-case" | "library" | "case-portfolio" | "transcription" | "document-analysis" | "terms";
}

const CASE_MENU_ITEMS = [
  { tab: "create-case", label: "Create Case", href: "/homepage/create-case" },
  { tab: "case-portfolio", label: "Case Portfolio", href: "/homepage/case-portfolio" },
] as const;

export default function GlobalHeader({ activeTab }: GlobalHeaderProps) {
  const [isCaseMenuOpen, setIsCaseMenuOpen] = useState(false);
  const caseMenuRef = useRef<HTMLDivElement>(null);
  const isCaseTabActive = activeTab === "create-case" || activeTab === "case-portfolio";

  // Close the dropdown on outside click, since it isn't a native <select>.
  useEffect(() => {
    if (!isCaseMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (caseMenuRef.current && !caseMenuRef.current.contains(e.target as Node)) {
        setIsCaseMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCaseMenuOpen]);

  // Helper to dynamically toggle active states for the sub-tier workspace links
  const getSubTabClass = (tabName: string) => {
    const baseClasses = "text-[10px] tracking-[1px] uppercase transition-all duration-200";

    if (activeTab === tabName) {
      // Active Look: Full opacity, bold text, white bottom border
      return `${baseClasses} text-white border-b-2 border-white pb-[6px] font-bold opacity-100`;
    }

    // Inactive Look: Dimmed opacity, brightens to white on hover
    return `${baseClasses} opacity-60 text-white hover:opacity-100`;
  };

  return (
    <header className="absolute top-0 left-0 w-full bg-[#0b132b] border-b border-white/10 z-50">
      <div className="w-full h-14 flex items-center gap-8 px-72">
        <a href="/" className="font-['Libre_Caslon_Text'] text-white text-[20px] tracking-[-0.6px] shrink-0">
          ilovelawyer
        </a>

        <nav className="flex-1 flex items-center justify-center gap-7 text-[10px] tracking-[1px]">
          <a href="/homepage" className={getSubTabClass("consultation")}>CONSULTATION</a>

          <div className="relative" ref={caseMenuRef}>
            <button
              type="button"
              onClick={() => setIsCaseMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1 cursor-pointer ${
                isCaseTabActive
                  ? "text-[10px] tracking-[1px] uppercase transition-all duration-200 text-white border-b-2 border-white pb-[6px] font-bold opacity-100"
                  : "text-[10px] tracking-[1px] uppercase transition-all duration-200 opacity-60 text-white hover:opacity-100"
              }`}
              aria-haspopup="menu"
              aria-expanded={isCaseMenuOpen}
            >
              CASE
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${isCaseMenuOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {isCaseMenuOpen && (
              <div
                role="menu"
                className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-44 bg-white border border-white rounded-sm shadow-xl py-1"
              >
                {CASE_MENU_ITEMS.map((item) => (
                  <a
                    key={item.tab}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setIsCaseMenuOpen(false)}
                    className={`block px-4 py-2.5 text-[10px] tracking-[1px] uppercase transition-colors ${
                      activeTab === item.tab ? "text-black font-bold bg-black/5" : "text-black/60 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <a href="/homepage/library" className={getSubTabClass("library")}>LIBRARY</a>
          <a href="/homepage/transcription" className={getSubTabClass("transcription")}>TRANSCRIPTION</a>
          <a href="/homepage/document-analysis" className={getSubTabClass("document-analysis")}>DOCUMENTS</a>
          <a href="/homepage/terms" className={getSubTabClass("terms")}>TERMS</a>
        </nav>

        <div className="flex items-center gap-5 shrink-0">
          <button className="text-white/70 hover:text-white transition-opacity" aria-label="Search">🔍</button>
          <button className="text-white/70 hover:text-white transition-opacity" aria-label="Account">👤</button>
        </div>
      </div>
    </header>
  );
}