"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SharedFooter } from "@/components/shared-footer";
import svgResetPaths from "@/imports/ResetPasswordIlovelawyerUpdatedBranding/svg-f5h6gvo5lz";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const valid = newPassword.length >= 8 && /[^a-zA-Z0-9]/.test(newPassword);

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ background: "linear-gradient(90deg, #f7f9fb 0%, #f7f9fb 100%)" }}>
      <nav className="bg-white border-b border-[#d8dadc] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 md:px-16 flex items-center justify-between py-4">
          <Link href="/"><Logo size={20} /></Link>
          <div className="hidden md:flex items-center gap-8">
            {["Consultations", "Knowledge Base", "My Cases", "Pricing"].map((link) => (
              <span key={link} className="text-[#44474d] text-sm" style={{ fontFamily: "'Source Serif 4', serif" }}>
                {link}
              </span>
            ))}
          </div>
          <Link
            href="/signup"
            className="bg-[#0a192f] text-white text-sm px-6 py-2 rounded-lg hover:bg-[#142744] transition-colors"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-5 py-16 relative">
        <div className="absolute bg-[rgba(0,89,187,0.05)] blur-[60px] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 rounded-full size-[800px] pointer-events-none" />

        <div className="flex flex-col gap-8 w-full max-w-[448px] relative z-10">
          <div className="backdrop-blur-[6px] bg-white/80 rounded-3xl border border-[#d8dadc] shadow-[0px_8px_32px_0px_rgba(10,25,47,0.06)] p-10">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col items-center gap-3">
                <div className="bg-[rgba(0,89,187,0.1)] rounded-full size-14 flex items-center justify-center">
                  <svg className="size-[26px]" fill="none" viewBox="0 0 26.6667 26.6667">
                    <path d={svgResetPaths.p2d47e8c0} fill="#0059BB" />
                  </svg>
                </div>
                <h2
                  className="text-[#191c1e] text-[32px] text-center leading-10 pt-3"
                  style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
                >
                  Set new password
                </h2>
                <p className="text-[#44474d] text-base text-center leading-[26px]" style={{ fontFamily: "'Source Serif 4', serif" }}>
                  Your new password must be at least 8 characters and include a special character.
                </p>
              </div>

              {success ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <p className="text-green-800 text-base" style={{ fontFamily: "'Source Serif 4', serif" }}>
                    Password updated!{" "}
                    <Link href="/login" className="underline text-green-700">Sign in</Link>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[#44474d] text-xs tracking-[0.6px] uppercase" style={{ fontFamily: "'Source Serif 4', serif" }}>
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-[21px]">
                        <svg className="w-full h-full" fill="none" viewBox="0 0 16 21">
                          <path d={svgResetPaths.p12930f00} fill="#75777E" />
                        </svg>
                      </div>
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters + special char"
                        className="w-full bg-white border border-[#d8dadc] rounded-lg pl-11 pr-12 py-3.5 text-base text-[#191c1e] placeholder-[#d8dadc] outline-none focus:border-[#0059bb] transition-colors"
                        style={{ fontFamily: "'Source Serif 4', serif" }}
                      />
                      <button
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1"
                      >
                        <svg className="w-[22px] h-[15px]" fill="none" viewBox="0 0 22 15">
                          <path d={svgResetPaths.p3e801e80} fill="#D8DADC" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[#44474d] text-xs tracking-[0.6px] uppercase" style={{ fontFamily: "'Source Serif 4', serif" }}>
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-[21px]">
                        <svg className="w-full h-full" fill="none" viewBox="0 0 16 21">
                          <path d={svgResetPaths.p12930f00} fill="#75777E" />
                        </svg>
                      </div>
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full bg-white border border-[#d8dadc] rounded-lg pl-11 pr-12 py-3.5 text-base text-[#191c1e] placeholder-[#d8dadc] outline-none focus:border-[#0059bb] transition-colors"
                        style={{ fontFamily: "'Source Serif 4', serif" }}
                      />
                      <button
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1"
                      >
                        <svg className="w-[22px] h-[15px]" fill="none" viewBox="0 0 22 15">
                          <path d={svgResetPaths.p3e801e80} fill="#D8DADC" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => valid && passwordsMatch && setSuccess(true)}
                    disabled={!valid || !passwordsMatch}
                    className="w-full bg-[#0a192f] text-white text-base py-4 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-[#142744] transition-colors border-0 shadow-[0px_1px_1px_rgba(0,0,0,0.05)] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: "'Source Serif 4', serif" }}
                  >
                    Reset Password
                  </button>
                </div>
              )}

              <div className="border-t border-[#d8dadc] pt-6 flex justify-center">
                <Link
                  href="/login"
                  className="flex items-center gap-2 text-[#0a192f] text-base hover:underline"
                  style={{ fontFamily: "'Source Serif 4', serif" }}
                >
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
