"use client";
import React, { useState } from "react";
import GlobalHeader from "@/components/global-header";

// Robust SVG paths fallback helper to avoid crashes if imports are missing
const defaultSvgPaths = {
  p52a9da0: "M0 0h15v15H0z",
  p2d459a0: "M0 0h15v12H0z",
  p27f6b80: "M0 0h15v15H0z",
  p23f74b00: "M0 0h17v14H0z",
  p1829b000: "M0 0h12v15H0z",
  p2d0e3e80: "M0 0h14v15H0z",
};
// 1. Define the interface
interface NavLinkProps {
  text: string;
  isActive: boolean;
  iconPath?: string; // The '?' means it's optional
}

// --- Reusable Component Blocks ---

<GlobalHeader activeTab="transcription" />

interface FooterLinkSectionProps {
  title: string;
  links: string[];
}

function FooterLinkSection({ title, links }: FooterLinkSectionProps) {
  return (
    <div className="flex flex-col gap-[16px] items-start shrink-0 min-w-[120px]">
      <span className="font-['Inter',sans-serif] font-semibold text-[12px] text-black tracking-[1.2px]">
        {title}
      </span>
      {links.map((link, idx) => (
        <a key={idx} href={`#${link.toLowerCase().replace(/\s+/g, '-')}`} className="text-[#45464d] text-[14px] hover:text-black transition-colors">
          {link}
        </a>
      ))}
    </div>
  );
}

// --- Main Assembly Module ---

export default function IlovelawyerTranscriptionDashboard() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcripts, setTranscripts] = useState([]); // Array to feed real incoming processing items

  const navigationItems = [
  { text: "AI Chat", path: defaultSvgPaths.p52a9da0, active: false },
  { text: "Case Management", path: defaultSvgPaths.p2d459a0, active: false },
  { text: "Legal Library", path: defaultSvgPaths.p27f6b80, active: false },
  { text: "Transcription", path: defaultSvgPaths.p23f74b00, active: true },
  { text: "Document Analysis", path: defaultSvgPaths.p1829b000, active: false },
  { text: "Statutory Terms", path: defaultSvgPaths.p2d0e3e80, active: false }
];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.currentTarget.files;
  // Checking 'if (files)' ensures files is not null before checking length
  if (files && files.length > 0) {
    alert(`Selected ${files.length} file(s) for transcription.`);
  }
};

  return (
    <div className="relative w-full min-h-screen bg-[#f7fafc] text-black font-['Inter',sans-serif]">
      
      {/* Dynamic Sub-Navigation Header Bar */}
      <GlobalHeader activeTab="transcription" />

      {/* Main Content View Frame */}
      <main className="max-w-[1440px] mx-auto px-[64px] py-[80px] grid grid-cols-12 gap-[32px]">
        
        {/* Banner Section Info */}
        <div className="col-span-12 flex flex-col gap-[50px] mb-[2px]">
          <span className="text-[#735c00] text-[12px] font-semibold tracking-[1.2px] uppercase">Linguistic Intelligence</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[64px] leading-[80px] text-[#181c1e]">
            Transcription <span className="italic">Redefined.</span>
          </h1>
        </div>

        {/* Primary Functional Panel Columns */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-[32px]">
          
          {/* Card: Launch live recorder controller */}
          <div className="bg-[#131a33]  rounded-xl text-white p-[48px] rounded-[4px] relative overflow-hidden flex flex-col justify-between min-h-[360px]">
            <div className="flex flex-col gap-[16px]">
              <div className="text-[#FFE088] text-[24px]">🎙️</div>
              <h2 className="font-['Libre_Caslon_Text',serif] text-[40px]">Start New Recording</h2>
              <p className="text-[#7b83a0] text-[18px] max-w-[448px] leading-[24px]">
                Live capture with real-time speaker identification and timestamping. Optimized for boardroom acoustics and court protocols.
              </p>
            </div>
            <button 
              onClick={() => setIsRecording(!isRecording)} 
              className={`mt-6 self-start px-[24px] py-[12px] font-semibold tracking-[1.2px] text-[12px] border transition-colors rounded ${
                isRecording ? "bg-red-600 border-red-600 text-white" : "bg-transparent border-white text-white hover:bg-white/10"
              }`}
            >
              {isRecording ? "🛑 STOP RECORDER" : "LAUNCH RECORDER"}
            </button>
          </div>

          {/* Card: System File Uploader Integration */}
          <div className="bg-white/85 backdrop-blur-[6px] border border-[#e2e8f0]/50 shadow-sm p-[41px] flex justify-between items-center gap-4 flex-wrap">
            <div className="flex gap-[24px] items-start">
              <span className="text-[24px] text-[#545F72]"></span>
              <div>
                <h3 className="font-['Libre_Caslon_Text',serif] text-[24px] text-[#181c1e]">Upload Audio File</h3>
                <p className="text-[#45464d] text-[16px]">MP3, WAV, or AAC up to 2GB. Multi-channel support.</p>
              </div>
            </div>
            <label className="bg-black text-white px-[32px] py-[16px] text-[12px] font-semibold tracking-[1.2px] uppercase cursor-pointer hover:bg-neutral-800 transition-colors rounded">
              Select Files
              <input type="file" accept="audio/*" multiple className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        {/* Sidebar Status Realtime Queue Display */}
        <div className="col-span-12 lg:col-span-5 bg-white/85 backdrop-blur-[6px] border border-[#c6c6ce] rounded-xl p-[36px] flex flex-col justify-between min-h-[500px]">
          <div>
            <div className="flex justify-between items-center border-b border-[#c6c6ce] pb-[17px] mb-[32px]">
              <span className="text-[12px] font-semibold tracking-[1.2px] text-black">ACTIVITY QUEUE</span>
              <span className="bg-[#e0e3e5] text-[#45464d] text-[10px] font-bold px-[8px] py-[4px] tracking-wider rounded">LIVE</span>
            </div>

            {transcripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center opacity-60 py-[60px]">
                <div className="w-[64px] h-[64px] bg-[#f1f4f6] rounded-full flex items-center justify-center text-[24px] mb-4">📄</div>
                <h4 className="font-['Libre_Caslon_Text',serif] text-[28px] text-[#181c1e] mb-2">No Active Transcripts</h4>
                <p className="text-[#45464d] text-[16px]">Your processed hearings and recordings will appear here for review.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Dynamically loops list items when arrays populate hooks */}
              </div>
            )}
          </div>

          <a href="#full-library" className="border-t border-[#c6c6ce] pt-[33px] flex justify-between items-center font-semibold text-[12px] text-[#181c1e] tracking-[1.2px] hover:underline">
            <span>VIEW FULL LIBRARY</span>
            <span>➔</span>
          </a>
        </div>
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