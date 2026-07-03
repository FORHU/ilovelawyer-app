// apps/web/components/global-header.tsx
import React from "react";

interface GlobalHeaderProps {
  // Enforces passing one of your exact six workspace pages
  activeTab: "consultation" | "create-case" | "library" | "transcription" | "document-analysis" | "terms";
}

export default function GlobalHeader({ activeTab }: GlobalHeaderProps) {
  // Helper to dynamically toggle active states for the sub-tier workspace links
  const getSubTabClass = (tabName: string) => {
    const baseClasses = "text-[10px] tracking-[1px] uppercase transition-all duration-200";
    
    if (activeTab === tabName) {
      // Active Look: Full opacity, bold text, white bottom border
      return `${baseClasses} border-b-2 border-white pb-[6px] font-bold opacity-100`;
    }
    
    // Inactive Look: Dimmed opacity, brightens to white on hover
    return `${baseClasses} opacity-60 text-white hover:opacity-100`;
  };

  return (
    <header className="absolute top-0 left-0 w-full bg-white border-b border-[#c6c6ce] z-50">
      {/* Top Main Navigation Row */}
      <div className="max-w-[1024px] mx-auto h-[64px] flex items-center justify-between px-[32px]">
        <div className="font-['Libre_Caslon_Text'] text-[#0b132b] text-[24px] tracking-[-0.6px]">
          ilovelawyer
        </div>
        <nav className="flex gap-[32px] text-[10px] font-bold tracking-[1px] text-[#0b132b]">
          {/* Kept static as requested; can also be made dynamic if needed later */}
          <a href="#platform" className="border-b-2 border-[#0b132b] pb-[6px]">PLATFORM</a>
          <a href="#solutions" className="text-gray-500 uppercase">SOLUTIONS</a>
          <a href="#pricing" className="text-gray-500 uppercase">PRICING</a>
        </nav>
        <div className="flex gap-[24px]">
          <button className="opacity-60 hover:opacity-100 transition-opacity">🔍</button>
          <button className="opacity-60 hover:opacity-100 transition-opacity">👤</button>
        </div>
      </div>
      
      {/* Dark Sub-Tier Workspace Bar */}
      <div className="bg-[#0b132b] backdrop-blur-[6px] text-white border-b border-white/10">
        <div className="max-w-[1024px] mx-auto h-[48px] flex items-center justify-center gap-[32px] text-[10px] tracking-[1px]">
          <a href="/homepage" className={getSubTabClass("homepage")}>CONSULTATION</a>
          <a href="/homepage/create-case" className={getSubTabClass("create-case")}>CASE</a>
          <a href="/homepage/case-manager" className={getSubTabClass("case-management")}>CASE MANAGER</a>
          <a href="/homepage/library" className={getSubTabClass("library")}>LIBRARY</a>
          <a href="/homepage/transcription" className={getSubTabClass("transcription")}>TRANSCRIPTION</a>
          <a href="/homepage/document-analysis" className={getSubTabClass("document-analysis")}>DOCUMENTS</a>
          <a href="/homepage/terms" className={getSubTabClass("terms")}>TERMS</a>
        </div>
      </div>
    </header>
  );
}