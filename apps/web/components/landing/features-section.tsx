import Link from "next/link";
import { Bot, Briefcase, FileSearch, Mic } from "lucide-react";

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 px-8 md:px-16 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#f1f4f6]/80" />
        <div className="absolute inset-0 backdrop-blur-[2px] bg-[rgba(241,244,246,0.8)]" />
      </div>

      <div className="relative z-10 max-w-360 mx-auto">
        <div className="grid grid-cols-12 gap-8 mb-8">
          <div className="col-start-2 col-span-10 flex items-end justify-between pb-16">
            <div>
              <h2 className="text-[40px] text-black leading-[48px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
                Operational Intelligence
              </h2>
              <p className="text-[#45464d] text-base mt-4 leading-[1.6]" style={{ fontFamily: "Inter, sans-serif" }}>
                Our specialized legal technology stack automates manual processes with high-fidelity AI processing.
              </p>
            </div>
            <Link
              href="/signup"
              className="flex flex-col items-start shrink-0 pb-1.5 border-b-2 border-black hover:opacity-70 transition-opacity duration-200"
            >
              <span className="text-black text-xs tracking-[1.2px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>EXPLORE PLATFORM</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* AI Research Chat */}
          <Link
            href="/signup"
            className="lg:col-start-2 lg:col-span-5 h-[400px] backdrop-blur-[6px] bg-[rgba(247,250,252,0.4)] border border-[rgba(198,198,206,0.3)] flex flex-col justify-between p-10 hover:border-[rgba(198,198,206,0.7)] hover:shadow-lg transition-all duration-200 cursor-pointer group"
          >
            <div className="flex flex-col gap-4">
              <Bot size={30} color="black" className="group-hover:scale-110 transition-transform duration-200" />
              <h3 className="text-[28px] text-black leading-[36px] pt-2" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
                AI Research Chat
              </h3>
              <p className="text-[#45464d] text-base leading-[1.6]" style={{ fontFamily: "Inter, sans-serif" }}>
                Real-time statutory interpretation and jurisprudence research via a natural language interface trained on current Supreme Court rulings.
              </p>
            </div>
            <span className="text-[#45464d] text-xs tracking-[1.2px] uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
              GET STARTED →
            </span>
          </Link>

          {/* Case Manager */}
          <div className="lg:col-span-5 h-[400px] bg-[#2d3133] relative overflow-hidden flex flex-col justify-between p-10 hover:shadow-xl transition-shadow duration-200">
            <div className="absolute bottom-[-133px] right-[-133px] size-[362px] flex items-center justify-center pointer-events-none">
              <div className="rotate-45 size-64 border border-[rgba(255,224,136,0.1)]" />
            </div>
            <div className="flex flex-col gap-4 relative z-10">
              <Briefcase size={28} color="#FFE088" />
              <h3 className="text-[28px] text-white leading-[36px] pt-2" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
                Case Manager
              </h3>
              <p className="text-[rgba(224,227,229,0.7)] text-base leading-[1.6]" style={{ fontFamily: "Inter, sans-serif" }}>
                A centralized ecosystem for docketing, calendar management, and strategic planning for complex litigation workflows.
              </p>
            </div>
            <Link
              href="/signup"
              className="relative z-10 self-start border-b border-[#ffe088] pb-1 hover:opacity-80 transition-opacity duration-200"
            >
              <span className="text-[#ffe088] text-xs tracking-[1.2px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>GET STARTED</span>
            </Link>
          </div>

          {/* Document Analysis */}
          <Link
            href="/signup"
            className="lg:col-start-2 lg:col-span-10 h-[320px] bg-white border border-[rgba(198,198,206,0.3)] flex items-center hover:shadow-lg hover:border-[rgba(198,198,206,0.6)] transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center gap-8 p-10 w-full h-full">
              <div className="flex-1 flex flex-col gap-4">
                <FileSearch size={27} color="black" className="group-hover:scale-110 transition-transform duration-200" />
                <h3 className="text-[28px] text-black leading-[36px] pt-2" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
                  Document Analysis
                </h3>
                <p className="text-[#45464d] text-base leading-[1.6]" style={{ fontFamily: "Inter, sans-serif" }}>
                  Automated contract review and risk assessment. Detect inconsistencies across multi-volume discovery sets in seconds.
                </p>
              </div>
              <div className="flex-1 h-full relative overflow-hidden hidden lg:block bg-[#f1f4f6]/50" />
            </div>
          </Link>

          {/* Voice Transcription */}
          <Link
            href="/signup"
            className="lg:col-start-2 lg:col-span-10 h-[280px] bg-[#ebeef0] flex items-center hover:bg-[#e4e8ea] transition-colors duration-200 group cursor-pointer"
          >
            <div className="flex items-center justify-between p-10 w-full">
              <div className="flex flex-col gap-2 max-w-[576px]">
                <h3 className="text-[28px] text-black leading-[36px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
                  Voice Transcription
                </h3>
                <p className="text-[#45464d] text-base leading-[1.6]" style={{ fontFamily: "Inter, sans-serif" }}>
                  Enterprise-grade transcription for courtroom proceedings and depositions with high semantic accuracy for legal terminology.
                </p>
              </div>
              <div className="border border-black rounded-full size-16 flex items-center justify-center shrink-0 group-hover:bg-black group-hover:border-black transition-colors duration-200">
                <Mic size={20} color="#181C1E" className="group-hover:text-white transition-colors duration-200" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
