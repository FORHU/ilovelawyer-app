"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { SharedFooter } from "@/components/shared-footer";
import svgLoginPaths from "@/imports/LoginSourceSerif/svg-ylobrpshkl";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ background: "linear-gradient(135deg, #f7f9fb 0%, #eef3fb 100%)" }}>
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative">
        <div className="absolute bg-[#d8e2ff] blur-[50px] top-0 left-[-10%] w-[40%] h-[40%] rounded-full opacity-20 pointer-events-none" />
        <div className="absolute bg-[#d6e3ff] blur-[50px] bottom-0 right-[-10%] w-[40%] h-[40%] rounded-full opacity-20 pointer-events-none" />

        <div className="w-full max-w-[480px] flex flex-col gap-10 relative z-10">
          <div className="flex flex-col items-center gap-4">
            <Link href="/"><Logo size={30} /></Link>
            <p className="text-[#44474d] text-lg text-center" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Secure Access to AI Legal Excellence
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#d8dadc] shadow-[0px_8px_16px_rgba(10,25,47,0.06)] p-10">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[#44474d] text-sm tracking-[1.4px] uppercase" style={{ fontFamily: "'Source Serif 4', serif" }}>
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-4">
                    <svg className="w-full h-full" fill="none" viewBox="0 0 20 16">
                      <path d={svgLoginPaths.p13e73800} fill="#75777E" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="attorney@firm.com"
                    className="w-full bg-[#f2f4f6] border border-[#d8dadc] rounded-2xl pl-10 pr-4 py-3.5 text-base text-[#191c1e] placeholder-[rgba(117,119,126,0.5)] outline-none focus:border-[#0059bb] transition-colors"
                    style={{ fontFamily: "'Source Serif 4', serif" }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[#44474d] text-sm tracking-[1.4px] uppercase" style={{ fontFamily: "'Source Serif 4', serif" }}>
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-[#0059bb] text-sm hover:underline" style={{ fontFamily: "'Source Serif 4', serif" }}>
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-[21px]">
                    <svg className="w-full h-full" fill="none" viewBox="0 0 16 21">
                      <path d={svgLoginPaths.p12930f00} fill="#75777E" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#f2f4f6] border border-[#d8dadc] rounded-2xl pl-10 pr-12 py-3.5 text-base text-[#191c1e] outline-none focus:border-[#0059bb] transition-colors"
                    style={{ fontFamily: "'Source Serif 4', serif" }}
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1"
                  >
                    <svg className="w-[22px] h-[15px]" fill="none" viewBox="0 0 22 15">
                      <path d={svgLoginPaths.p3e801e80} fill="#75777E" />
                    </svg>
                  </button>
                </div>
              </div>

              <button
                className="w-full bg-[#0a192f] text-white text-sm py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer hover:bg-[#142744] transition-colors border-0 mt-2"
                style={{ fontFamily: "'Source Serif 4', serif" }}
              >
                Sign In
              </button>

              <div className="h-px bg-[#d8dadc]" />

              <button
                className="w-full bg-white border border-[#d8dadc] rounded-2xl py-3.5 px-1 flex items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ fontFamily: "'Source Serif 4', serif" }}
              >
                <svg className="size-5" fill="none" viewBox="0 0 20 20">
                  <path d={svgLoginPaths.p29ad9380} fill="#4285F4" />
                  <path d={svgLoginPaths.p73c0a80} fill="#34A853" />
                  <path d={svgLoginPaths.p1f69ba00} fill="#FBBC05" />
                  <path d={svgLoginPaths.p372b9e00} fill="#EA4335" />
                </svg>
                <span className="text-[#191c1e] text-sm">Continue with Google</span>
              </button>

              <p className="text-[#44474d] text-base text-center" style={{ fontFamily: "'Source Serif 4', serif" }}>
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-[#0059bb] hover:underline" style={{ fontFamily: "'Source Serif 4', serif" }}>
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <SharedFooter compact />
    </div>
  );
}
