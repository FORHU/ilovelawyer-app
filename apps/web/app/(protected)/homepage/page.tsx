"use client";
import React, { useState } from "react";

export default function AiConsultationPage() {
  const [inputMessage, setInputMessage] = useState("");

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!inputMessage.trim()) return;
  console.log("Sending to AI:", inputMessage);
  setInputMessage("");
};

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between pb-[128px] pt-[112px] px-[32px] md:px-[128px] bg-slate-50">
      {/* Background Layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#eef2f7] to-[#dbe1ff] pointer-events-none z-0" />

      {/* Navigation Header */}
      <header className="absolute top-0 left-0 w-full bg-white border-b border-[#c6c6ce] z-50">
        <div className="max-w-[1024px] mx-auto h-[64px] flex items-center justify-between px-[32px]">
          <div className="font-['Libre_Caslon_Text'] font-bold text-[#0b132b] text-[24px] tracking-[-0.6px]">
            ILOVELAWYER
          </div>
          <nav className="flex gap-[32px] text-[10px] font-bold tracking-[1px] text-[#0b132b]">
            <a href="#platform" className="border-b-2 border-[#0b132b] pb-[6px]">PLATFORM</a>
            <a href="#solutions" className="text-gray-500 uppercase">SOLUTIONS</a>
            <a href="#pricing" className="text-gray-500 uppercase">PRICING</a>
          </nav>
          <div className="flex gap-[24px]">
            {/* Search/User Icons */}
            <button className="opacity-60">🔍</button>
            <button className="opacity-60">👤</button>
          </div>
        </div>
        
        {/* Sub-tier bar */}
        <div className="bg-[#0b132b] backdrop-blur-[6px] text-white border-b border-white/10">
          <div className="max-w-[1024px] mx-auto h-[48px] flex items-center justify-center gap-[32px] text-[10px] tracking-[1px]">
            <a href="#consultation" className="border-b-2 border-white pb-[6px] font-bold">CONSULTATION</a>
            <a href="#case" className="opacity-60">CASE</a>
            <a href="#library" className="opacity-60">LEGAL LIBRARY</a>
          </div>
        </div>
      </header>

      {/* Left Sidebar Panel */}
      <aside className="absolute left-0 top-[112px] w-[64px] bg-white/80 backdrop-blur-[12px] border-r border-y border-white/40 rounded-r-[8px] shadow-lg flex flex-col items-center py-[16px] z-40">
        <button className="h-[48px] w-full flex items-center justify-center hover:bg-slate-100" title="New Chat">➕</button>
        <button className="h-[48px] w-full flex items-center justify-center hover:bg-slate-100" title="History">⏳</button>
        <button className="h-[48px] w-full flex items-center justify-center hover:bg-slate-100" title="Gallery">🖼️</button>
      </aside>

      {/* Main Chat Interface */}
      <main className="relative z-10 max-w-[1024px] w-full mx-auto flex flex-col items-center justify-center flex-1 pt-[64px]">
        <div className="text-center mb-[48px] max-w-[672px]">
          <h1 className="font-['Libre_Caslon_Text'] font-normal text-[#0b132b] text-[48px] tracking-[-1.2px] mb-[16px]">
            Expert Legal Consultation
          </h1>
          <p className="font-['Inter'] text-[#181c1e] text-[16px] leading-[24px]">
            Secure, AI-powered legal analysis and case drafting for the modern practitioner.
          </p>
        </div>

        {/* Interactive Glassmorphic Chat Input Bar */}
        <form 
          onSubmit={handleSendMessage}
          className="w-full max-w-[768px] backdrop-blur-[12px] bg-white/80 p-[16px] rounded-full border border-white/40 shadow-xl flex items-center gap-[16px]"
        >
          {/* Action buttons (Attach/Voice) */}
          <div className="flex gap-[8px]">
            <button type="button" className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-slate-200/50">📎</button>
            <button type="button" className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-slate-200/50">🎙️</button>
          </div>

          {/* Actual Active Input field instead of a static div */}
          <input
            type="text"
            className="flex-1 bg-transparent border-none outline-none font-['Inter'] text-[18px] text-[#181c1e] placeholder-gray-400 px-[4px]"
            placeholder="Draft your legal inquiry or case particulars here..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
          />

          {/* Submit Button */}
          <button 
            type="submit"
            className="bg-[#0b132b] text-white w-[48px] h-[48px] rounded-full flex items-center justify-center shadow-md hover:bg-[#162244] transition-colors"
          >
            ➔
          </button>
        </form>
      </main>
    </div>
  );
}