import Link from "next/link";
import svgPaths from "@/imports/IlovelawyerLandingPageWithInActionSection/svg-4n6twsb3v9";

export function HeroSection() {
  return (
    <section className="bg-[#f7f9fb] min-h-[80vh] flex items-center py-24 px-6 md:px-16 overflow-hidden">
      <div className="max-w-[1200px] mx-auto w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        <div className="flex-1 flex flex-col gap-8">
          <div className="bg-[rgba(0,89,187,0.1)] h-2.5 w-6 rounded-full border border-[rgba(0,89,187,0.2)]" />
          <h1
            className="text-[#0a192f] text-[clamp(40px,6vw,64px)] tracking-[-1.6px] leading-[1.1]"
            style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
          >
            Navigate{" "}
            <em className="text-[#d4af37] not-italic" style={{ fontStyle: "italic" }}>Philippine<br />Law</em>{" "}
            with AI<br />Precision
          </h1>
          <p
            className="text-[#44474d] text-[clamp(16px,2vw,24px)] max-w-[576px] leading-[1.6]"
            style={{ fontFamily: "'Source Serif 4', serif", fontStyle: "italic" }}
          >
            Your trusted digital companion for navigating the complexities of the Philippine legal system.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="bg-[#0a192f] text-white text-base px-8 py-[18px] rounded-lg hover:bg-[#142744] transition-colors"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              Start Free Consultation
            </Link>
            <button
              className="text-[#0059bb] text-base px-8 py-[18px] rounded-lg cursor-pointer hover:bg-[#0059bb]/5 transition-colors border-2 border-[#0059bb] bg-transparent"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              View Pricing
            </button>
          </div>
        </div>

        <div className="flex-1 max-w-[500px] w-full relative">
          <div className="absolute bg-[rgba(0,89,187,0.05)] blur-[32px] right-[-48px] top-[-48px] rounded-full size-64 pointer-events-none" />
          <div className="absolute bg-[rgba(10,25,47,0.05)] blur-[20px] bottom-[-48px] left-[-48px] rounded-full size-48 pointer-events-none" />
          <div className="backdrop-blur-[6px] bg-white/80 rounded-xl border border-white/30 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] p-6 relative">
            <div className="rounded-lg overflow-hidden aspect-square bg-[#e8edf5] flex items-center justify-center">
              <span className="text-[#76849f] text-sm" style={{ fontFamily: "'Source Serif 4', serif" }}>Interface preview</span>
            </div>
            <div className="mt-6 pt-4 border-t border-[#d8dadc] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-[rgba(0,89,187,0.1)] rounded-full size-8 flex items-center justify-center">
                  <svg className="size-[14px]" fill="none" viewBox="0 0 13.5 14.25">
                    <path d={svgPaths.p2dce480} fill="#0059BB" />
                  </svg>
                </div>
                <div className="bg-[rgba(0,89,187,0.1)] rounded-full size-8 flex items-center justify-center">
                  <svg className="size-[16px]" fill="none" viewBox="0 0 16.5 15.75">
                    <path d={svgPaths.p26ccbe40} fill="#0059BB" />
                  </svg>
                </div>
              </div>
              <span
                className="text-[#44474d]/60 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Source Serif 4', serif" }}
              >
                ENTERPRISE SECURED
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
