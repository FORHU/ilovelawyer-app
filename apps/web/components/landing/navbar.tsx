"use client";

import { useState } from "react";
import Link from "next/link";

const navLinks = [
  { label: "Platform", href: "#features" },
  { label: "Solutions", href: "#features" },
  { label: "Legal Library", href: "/signup" },
  { label: "Pricing", href: "/signup" },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="backdrop-blur-md bg-[rgba(247,250,252,0.85)] w-full border-b border-[rgba(198,198,206,0.3)] sticky top-0 z-50">
      <div className="max-w-360 mx-auto flex items-center justify-between px-8 md:px-16 py-5">
        <Link href="/" className="cursor-pointer">
          <span className="text-[28px] text-black tracking-[-0.7px]" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
            ilovelawyer
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="relative text-base text-[#45464d] hover:text-black transition-colors duration-200 group"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {label}
              <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 bg-black transition-all duration-200 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-6">
          <Link
            href="/login"
            className="text-[#45464d] text-base hover:text-black transition-colors duration-200"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="bg-black text-white text-xs tracking-[1.2px] uppercase px-6 py-2.5 hover:bg-[#1a1a1a] transition-colors duration-200"
            style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
          >
            Request Demo
          </Link>
        </div>

        <button
          className="lg:hidden p-2 cursor-pointer bg-transparent border-0"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M6 14L14 6" />
            </svg>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="w-5 h-0.5 bg-black" />
              <div className="w-5 h-0.5 bg-black" />
              <div className="w-5 h-0.5 bg-black" />
            </div>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-[#f7fafc] border-t border-[rgba(198,198,206,0.3)] px-8 py-6 flex flex-col gap-4">
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="text-base text-[#45464d] hover:text-black transition-colors duration-200"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {label}
            </Link>
          ))}
          <div className="flex gap-3 mt-2">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex-1 border border-black text-black text-xs px-4 py-3 text-center hover:bg-black/5 transition-colors duration-200"
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="flex-1 bg-black text-white text-xs px-4 py-3 text-center hover:bg-[#1a1a1a] transition-colors duration-200"
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
