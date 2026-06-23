"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SharedFooter } from "@/components/shared-footer";
import svgSignupPaths from "@/imports/SignUpIlovelawyerUpdatedBranding/svg-192ugpzk7r";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ background: "linear-gradient(90deg, #f7f9fb 0%, #f7f9fb 100%)" }}>
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 md:px-16 py-8 z-10">
        <Link href="/" className="cursor-pointer">
          <Logo size={16} />
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-[#44474d] text-base hover:text-[#0a192f] transition-colors"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          <svg className="size-3" fill="none" viewBox="0 0 12 12">
            <path d={svgSignupPaths.p2286b600} fill="#44474D" />
          </svg>
          Back to Home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-24 relative">
        <div className="absolute bg-[#0a192f] blur-[60px] opacity-5 right-[-96px] top-[-96px] rounded-full size-96 pointer-events-none" />
        <div className="absolute bg-[#d4af37] blur-[60px] opacity-5 left-[-96px] bottom-[-96px] rounded-full size-96 pointer-events-none" />

        <div className="backdrop-blur-[6px] bg-white/80 rounded-xl border border-[#d8dadc] shadow-[0px_8px_32px_0px_rgba(10,25,47,0.06)] p-12 w-full max-w-[480px] relative z-10 flex flex-col gap-10">
          <div className="flex flex-col gap-3 items-center text-center">
            <h2 className="text-[#191c1e] text-base" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}>
              Join the Future of Law
            </h2>
            <p className="text-[#44474d] text-base leading-6" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Create an account to start your AI-powered legal consultation in seconds.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[#191c1e] text-base tracking-[0.8px] uppercase" style={{ fontFamily: "'Source Serif 4', serif" }}>
                Full Name
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 size-4">
                  <svg className="size-full" fill="none" viewBox="0 0 16 16">
                    <path d={svgSignupPaths.p85bff00} fill="#75777E" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Thorne"
                  className="w-full bg-white border border-[#d8dadc] rounded-lg pl-11 pr-4 py-3.5 text-base text-[#191c1e] placeholder-[#d8dadc] outline-none focus:border-[#0059bb] transition-colors"
                  style={{ fontFamily: "'Source Serif 4', serif" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[#191c1e] text-base tracking-[0.8px] uppercase" style={{ fontFamily: "'Source Serif 4', serif" }}>
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-4">
                  <svg className="w-full h-full" fill="none" viewBox="0 0 20 16">
                    <path d={svgSignupPaths.p13e73800} fill="#75777E" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@firm.com"
                  className="w-full bg-white border border-[#d8dadc] rounded-lg pl-11 pr-4 py-3.5 text-base text-[#191c1e] placeholder-[#d8dadc] outline-none focus:border-[#0059bb] transition-colors"
                  style={{ fontFamily: "'Source Serif 4', serif" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pb-4">
              <label className="text-[#191c1e] text-base tracking-[0.8px] uppercase" style={{ fontFamily: "'Source Serif 4', serif" }}>
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-[21px]">
                  <svg className="w-full h-full" fill="none" viewBox="0 0 16 21">
                    <path d={svgSignupPaths.p12930f00} fill="#75777E" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 12 characters"
                  className="w-full bg-white border border-[#d8dadc] rounded-lg pl-11 pr-12 py-3.5 text-base text-[#191c1e] placeholder-[#d8dadc] outline-none focus:border-[#0059bb] transition-colors"
                  style={{ fontFamily: "'Source Serif 4', serif" }}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1"
                >
                  <svg className="w-[22px] h-[15px]" fill="none" viewBox="0 0 22 15">
                    <path d={svgSignupPaths.p3e801e80} fill="#D8DADC" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              className="w-full bg-[#0a192f] text-white text-base py-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-[#142744] transition-colors border-0 shadow-[0px_1px_1px_rgba(0,0,0,0.05)] tracking-[0.8px] uppercase"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              Create Account
              <svg className="size-3" fill="none" viewBox="0 0 12 12">
                <path d={svgSignupPaths.p304eaa0} fill="white" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-6 items-center">
            <p className="text-[#44474d] text-base text-center" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Already have an account?{" "}
              <Link href="/login" className="text-[#0a192f] font-medium hover:underline" style={{ fontFamily: "'Source Serif 4', serif" }}>
                Log in
              </Link>
            </p>

            <button
              className="w-full bg-transparent border border-[#d8dadc] rounded-lg py-4 flex items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              <svg className="size-5" fill="none" viewBox="0 0 20 20">
                <path d={svgSignupPaths.p29ad9380} fill="#4285F4" />
                <path d={svgSignupPaths.p73c0a80} fill="#34A853" />
                <path d={svgSignupPaths.p15c0f980} fill="#FBBC05" />
                <path d={svgSignupPaths.p3d0b3f00} fill="#EA4335" />
              </svg>
              <span className="text-[#191c1e] text-base tracking-[0.8px]" style={{ fontFamily: "'Source Serif 4', serif" }}>
                Continue with Google
              </span>
            </button>

            <p className="text-[#44474d] text-xs text-center max-w-[320px]" style={{ fontFamily: "'Source Serif 4', serif" }}>
              By clicking &quot;Create Account&quot;, you agree to ilovelawyer&apos;s{" "}
              <span className="underline cursor-pointer">Terms of Service</span> and{" "}
              <span className="underline cursor-pointer">Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>

      <SharedFooter />
    </div>
  );
}
