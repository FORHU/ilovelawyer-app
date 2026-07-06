// apps/web/components/global-header.tsx
import React from "react";

interface GlobalHeaderProps {
  // Enforces passing one of your exact six workspace pages
  activeTab: "consultation" | "create-case" | "library" | "case-portfolio" | "transcription" | "document-analysis" | "terms";
}

export default function GlobalHeader({ activeTab }: GlobalHeaderProps) {
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
          <a href="/homepage/create-case" className={getSubTabClass("create-case")}>CASE</a>
          <a href="/homepage/case-portfolio" className={getSubTabClass("case-portfolio")}>CASE PORTFOLIO</a>
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