"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";

const navLinks = ["Consultations", "Knowledge Base", "My Cases", "Pricing"];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav className="bg-white dark:bg-[#0d1b2a] border-b border-[#d8dadc] dark:border-[#1e3350] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] sticky top-0 z-50 w-full">
      <div className="max-w-[1200px] mx-auto px-6 md:px-16 flex items-center justify-between py-4">
        <Link href="/" className="cursor-pointer bg-transparent border-0 p-0">
          <Logo size={28} />
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link}
              className="text-[#44474d] dark:text-[#94a3b8] text-base hover:text-[#0a192f] dark:hover:text-[#e2e8f0] transition-colors cursor-pointer bg-transparent border-0"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              {link}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="text-[#0059bb] text-sm px-4 py-2 cursor-pointer hover:underline"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            Get Started
          </Link>
          <Link
            href="/signup"
            className="bg-[#0a192f] dark:bg-[#0059bb] text-white text-sm px-5 py-2 rounded-lg hover:bg-[#142744] dark:hover:bg-[#0070ea] transition-colors"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            Quick AI Consultation
          </Link>
          <ThemeToggle />
        </div>
        <div className="md:hidden flex items-center gap-1">
          <button
            className="p-2 cursor-pointer bg-transparent border-0"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <div className="w-5 h-0.5 bg-[#0a192f] dark:bg-[#e2e8f0] mb-1" />
            <div className="w-5 h-0.5 bg-[#0a192f] dark:bg-[#e2e8f0] mb-1" />
            <div className="w-5 h-0.5 bg-[#0a192f] dark:bg-[#e2e8f0]" />
          </button>
            <ThemeToggle />
        </div>
        
      </div>
      
      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-[#0d1b2a] border-t border-[#d8dadc] dark:border-[#1e3350] px-6 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <button
              key={link}
              className="text-[#44474d] dark:text-[#94a3b8] text-base text-left cursor-pointer bg-transparent border-0"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              {link}
            </button>
          ))}
          <div className="flex gap-3 mt-2">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-[#0059bb] text-sm px-4 py-2 rounded-lg border border-[#0059bb] cursor-pointer bg-transparent flex-1 text-center"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="bg-[#0a192f] dark:bg-[#0059bb] text-white text-sm px-4 py-2 rounded-lg cursor-pointer flex-1 text-center"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
  }
