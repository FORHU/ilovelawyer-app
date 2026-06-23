"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SharedFooter } from "@/components/shared-footer";
import svgForgotPaths from "@/imports/ForgotPasswordIlovelawyerUpdatedBranding/svg-c3dgwficg5";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ background: "linear-gradient(90deg, #f7f9fb 0%, #f7f9fb 100%)" }}>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="flex flex-col gap-8 w-full max-w-[480px]">
          <div className="flex justify-start">
            <Link href="/" className="cursor-pointer">
              <Logo size={24} />
            </Link>
          </div>

          <div className="backdrop-blur-[6px] bg-white/80 rounded-3xl border border-[#d8dadc] shadow-[0px_8px_32px_0px_rgba(10,25,47,0.06)] p-10">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col items-center gap-3">
                <div className="bg-[rgba(10,25,47,0.05)] rounded-full size-14 flex items-center justify-center">
                  <svg className="size-[26px]" fill="none" viewBox="0 0 26.6667 26.6667">
                    <path d={svgForgotPaths.p2d47e8c0} fill="#0A192F" />
                  </svg>
                </div>
                <h2
                  className="text-[#191c1e] text-[32px] text-center leading-10 pt-3"
                  style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
                >
                  Reset your password
                </h2>
                <p className="text-[#44474d] text-base text-center leading-[26px]" style={{ fontFamily: "'Source Serif 4', serif" }}>
                  Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              {sent ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <p className="text-green-800 text-base" style={{ fontFamily: "'Source Serif 4', serif" }}>
                    Recovery email sent! Check your inbox at <strong>{email}</strong>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[#44474d] text-xs tracking-[0.6px] uppercase" style={{ fontFamily: "'Source Serif 4', serif" }}>
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@firm.com"
                        className="w-full bg-white border border-[#d8dadc] border-b-2 rounded-tl rounded-tr py-3.5 px-4 text-base text-[#191c1e] placeholder-[#6b7280] outline-none focus:border-[#0059bb] transition-colors pr-12"
                        style={{ fontFamily: "'Source Serif 4', serif" }}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-4">
                        <svg className="w-full h-full" fill="none" viewBox="0 0 20 16">
                          <path d={svgForgotPaths.p13e73800} fill="#75777E" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => email && setSent(true)}
                    className="w-full bg-[#0a192f] text-white text-base py-4 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-[#142744] transition-colors border-0 shadow-[0px_1px_1px_rgba(0,0,0,0.05)]"
                    style={{ fontFamily: "'Source Serif 4', serif" }}
                  >
                    Send Recovery Email
                  </button>
                </div>
              )}

              <div className="border-t border-[#d8dadc] pt-6 flex justify-center">
                <Link
                  href="/login"
                  className="flex items-center gap-2 text-[#0a192f] text-base hover:underline"
                  style={{ fontFamily: "'Source Serif 4', serif" }}
                >
                  <svg className="size-3" fill="none" viewBox="0 0 12 12">
                    <path d={svgForgotPaths.p2286b600} fill="#0A192F" />
                  </svg>
                  Return to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SharedFooter compact />
    </div>
  );
}
