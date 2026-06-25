import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-[#f7fafc]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#e8e0d0]/30 via-[#f0ebe0]/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f7fafc] via-[rgba(247,250,252,0.8)] to-[rgba(247,250,252,0)]" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto w-full px-8 md:px-16 py-24 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-start-2 lg:col-span-8 flex flex-col gap-6">
          <p className="text-[#735c00] text-xs tracking-[2.4px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
            THE FUTURE OF JURISPRUDENCE
          </p>
          <h1
            className="text-black text-[clamp(40px,5.5vw,64px)] tracking-[-1.28px] leading-[1.1]"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
          >
            Democratizing Access to<br />
            <em style={{ fontStyle: "italic" }}>Philippine Legal</em><br />
            Information
          </h1>
          <p className="text-[#45464d] text-lg leading-[1.6] max-w-[576px]" style={{ fontFamily: "Inter, sans-serif" }}>
            Leveraging specialized artificial intelligence to navigate the intricacies of Philippine jurisprudence. From litigation support to document synthesis, we provide legal professionals and the public with unparalleled analytical precision.
          </p>
          <div className="flex flex-wrap gap-6 pt-2">
            <Link
              href="/signup"
              className="bg-black text-white text-xs tracking-[1.2px] uppercase px-8 py-4 flex items-center gap-3 hover:bg-gray-800 transition-colors"
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
            >
              Start Free Consultation
              <ArrowUpRight size={14} color="white" />
            </Link>
            <button
              className="border border-black text-black text-xs tracking-[1.2px] uppercase px-8 py-4 cursor-pointer hover:bg-black/5 transition-colors bg-transparent"
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
            >
              View Case Studies
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
