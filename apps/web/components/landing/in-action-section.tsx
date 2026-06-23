"use client";

import { useState } from "react";
import svgPaths from "@/imports/IlovelawyerLandingPageWithInActionSection/svg-4n6twsb3v9";

export function InActionSection() {
  const [inputValue, setInputValue] = useState("");
  return (
    <section className="bg-[#f2f4f6] py-24 px-6 md:px-16 overflow-hidden">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-16 items-center">
        <div className="flex flex-col gap-4 items-center max-w-3xl text-center">
          <h2
            className="text-[#0a192f] text-[clamp(28px,4vw,42px)] leading-[1.5]"
            style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
          >
            AI Intelligence In Action
          </h2>
          <p className="text-[#44474d] text-lg" style={{ fontFamily: "'Source Serif 4', serif" }}>
            Experience how our legal AI analyzes complex cases in real-time.
          </p>
        </div>

        <div className="backdrop-blur-[6px] bg-white rounded-xl border border-[#d8dadc] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] w-full max-w-[896px] overflow-hidden">
          <div className="bg-[#f7f9fb] border-b border-[#d8dadc] px-6 py-4 flex items-center justify-end">
            <div className="flex gap-2">
              <div className="size-3 rounded-full bg-[#d8dadc]" />
              <div className="size-3 rounded-full bg-[#d8dadc]" />
              <div className="size-3 rounded-full bg-[#d8dadc]" />
            </div>
          </div>

          <div className="bg-[rgba(242,244,246,0.3)] p-6 flex flex-col gap-4 min-h-[250px]">
            <div className="flex items-start gap-4 justify-end">
              <div className="bg-[#0a192f] rounded-bl-xl rounded-tl-xl rounded-tr-xl px-4 py-3 max-w-[80%] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1)]">
                <p className="text-white text-base leading-6" style={{ fontFamily: "'Source Serif 4', serif" }}>
                  What are the legal requirements for terminating a lease under the Civil Code?
                </p>
              </div>
              <div className="bg-[#0059bb] rounded-full size-8 flex items-center justify-center shrink-0">
                <svg className="size-[9px]" fill="none" viewBox="0 0 9.33333 9.33333">
                  <path d={svgPaths.p6d5e700} fill="white" />
                </svg>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-[#0a192f] rounded-full size-8 flex items-center justify-center shrink-0">
                <svg className="size-[10px]" fill="none" viewBox="0 0 10.5 11.0833">
                  <path d={svgPaths.p3261c300} fill="white" />
                </svg>
              </div>
              <div className="bg-white rounded-bl-xl rounded-br-xl rounded-tr-xl border border-[#d8dadc] px-4 py-4 max-w-[80%] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                <p className="text-[rgba(10,25,47,0.9)] text-base leading-6" style={{ fontFamily: "'Source Serif 4', serif" }}>
                  Under the Civil Code of the Philippines, particularly Article 1673, a lessor cannot arbitrarily terminate a lease agreement prior to the expiration of the stipulated period. All terminations must follow proper legal procedures...
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border-t border-[#d8dadc] px-4 py-4 flex gap-4 items-center">
            <div className="flex-1 bg-[#f2f4f6] border border-[#d8dadc] rounded-lg h-10 flex items-center px-4">
              <input
                className="flex-1 bg-transparent text-sm text-[#44474d] outline-none placeholder-[rgba(68,71,77,0.4)]"
                placeholder="Type your response..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                style={{ fontFamily: "'Source Serif 4', serif" }}
              />
            </div>
            <button
              className="bg-[#0a192f] rounded-lg size-10 flex items-center justify-center cursor-pointer hover:bg-[#142744] transition-colors border-0 shrink-0"
              onClick={() => setInputValue("")}
            >
              <svg className="w-[19px] h-4" fill="none" viewBox="0 0 19 16">
                <path d={svgPaths.pb36e280} fill="white" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
