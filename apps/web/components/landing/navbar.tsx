"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Briefcase, BookOpen, Mic, FileSearch, Scale } from "lucide-react";

const navLinks = [
  { label: "Platform", active: true },
  { label: "Solutions" },
  { label: "Legal Library" },
  { label: "Pricing" },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="backdrop-blur- bg-[rgba(247,250,252,0.7)] w-full border-b border-[rgba(198,198,206,0.3)] sticky top-0 z-50">
      <div className="max-w-360 mx-auto flex items-center justify-between px-8 md:px-16 py-6">
        <Link href="/" className="cursor-pointer">
          <span className="text-[28px] text-black tracking-[-0.7px]" style={{ fontFamily: "'Libre Caslon Text', serif" }}>ilovelawyer</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map(({ label, active }) => (
            <div key={label} className="relative">
              <button
                className={`text-base cursor-pointer bg-transparent border-0 ${active ? "text-black" : "text-[#45464d]"}`}
                style={{ fontFamily: "Inter, sans-serif", fontWeight: active ? 700 : 400 }}
              >
                {label}
              </button>
              {active && <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-black" />}
            </div>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-6">
          <Link href="/login" className="text-[#45464d] text-base hover:text-black transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
            Sign In
          </Link>
          <Link href="/signup" className="bg-black text-white text-xs tracking-[1.2px] uppercase px-6 py-2 hover:bg-gray-800 transition-colors" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
            Request Demo
          </Link>
        </div>

        <button className="lg:hidden p-2 cursor-pointer bg-transparent border-0" onClick={() => setMobileOpen(!mobileOpen)}>
          <div className="w-5 h-0.5 bg-black mb-1.5" />
          <div className="w-5 h-0.5 bg-black mb-1.5" />
          <div className="w-5 h-0.5 bg-black" />
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-[#f7fafc] border-t border-[rgba(198,198,206,0.3)] px-8 py-6 flex flex-col gap-4">
          {navLinks.map(({ label }) => (
            <button key={label} className="text-left text-base text-[#45464d] cursor-pointer bg-transparent border-0" style={{ fontFamily: "Inter, sans-serif" }}>
              {label}
            </button>
          ))}
          <div className="flex gap-3 mt-2">
            <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 border border-black text-black text-xs px-4 py-3 text-center" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
              Sign In
            </Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)} className="flex-1 bg-black text-white text-xs px-4 py-3 text-center" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
              Get Started
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
