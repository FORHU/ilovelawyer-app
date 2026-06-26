"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import svgSignupPaths from "@/imports/SignUpIlovelawyerUpdatedBranding/svg-192ugpzk7r";
import { useSignupMutation, useGoogleAuthMutation } from "@/lib/auth/mutations";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signupMutation = useSignupMutation();
  const googleMutation = useGoogleAuthMutation();

  const isPending = signupMutation.isPending || googleMutation.isPending;

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setError(null);
    signupMutation.mutate(
      { name, email, password },
      { onError: (err) => setError((err as Error).message) }
    );
  }

  const googleLogin = useGoogleLogin({
    onSuccess: ({ access_token }) => {
      setError(null);
      googleMutation.mutate(
        { idToken: access_token },
        { onError: (err) => setError((err as Error).message) }
      );
    },
    onError: () => setError("Google sign-in failed. Please try again."),
  });

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#f7fafc]">
      {/* LEFT — dark architectural panel */}
      <div className="hidden lg:flex flex-col relative overflow-hidden" style={{ width: "40%", minHeight: "972px" }}>
        <div className="absolute inset-0 bg-[#131a33]" />
        <div className="absolute inset-0 opacity-80" style={{ background: "radial-gradient(ellipse at 50% 40%, #1e2a4a 0%, #131a33 60%)" }} />
        <div className="absolute inset-0 bg-[rgba(19,26,51,0.2)]" />
        <div className="absolute left-16 top-1/2 -translate-y-[60%] z-10">
          <h2
            className="text-[#f7fafc] text-[64px] leading-[80px] tracking-[-1.28px] mb-4"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
          >
            The Archive of<br />Excellence.
          </h2>
          <div className="bg-[#cca830] h-1 w-24 mb-6" />
          <p className="text-[#e0e3e5] text-lg leading-[28.8px] opacity-80 max-w-[384px]" style={{ fontFamily: "Inter, sans-serif" }}>
            Empowering the Philippine legal landscape through razor-sharp AI analysis and global research agility.
          </p>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="bg-white flex-1 flex flex-col items-center justify-center px-8 md:px-16 py-12 overflow-y-auto">
        <div className="w-full max-w-[448px] flex flex-col">
          {/* Kicker */}
          <p className="text-[#cca830] text-xs tracking-[2.4px] uppercase font-semibold mb-2" style={{ fontFamily: "Inter, sans-serif" }}>
            PLATFORM ENTRANCE
          </p>
          <h2 className="text-[40px] text-black leading-[48px] mt-2" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
            Join the Future of Law
          </h2>

          {/* Google button */}
          <div className="mt-12">
            <button
              type="button"
              disabled={isPending}
              onClick={() => googleLogin()}
              className="w-full bg-[#f7fafc] border border-[#c6c6ce] rounded-xl flex items-center justify-center gap-3 px-px py-[17px] cursor-pointer hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="size-5" fill="none" viewBox="0 0 20 20">
                <path d={svgSignupPaths.p29ad9380} fill="#4285F4" />
                <path d={svgSignupPaths.p73c0a80} fill="#34A853" />
                <path d={svgSignupPaths.p15c0f980} fill="#FBBC05" />
                <path d={svgSignupPaths.p3d0b3f00} fill="#EA4335" />
              </svg>
              <span className="text-[#181c1e] text-base font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                {googleMutation.isPending ? "Connecting..." : "Continue with Google"}
              </span>
            </button>
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-4 mt-12">
            <div className="bg-[#e0e3e5] h-px flex-1" />
            <span className="text-[#76767e] text-xs tracking-[1.2px] font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>OR</span>
            <div className="bg-[#e0e3e5] h-px flex-1" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-8 mt-12">
            {/* Full Name */}
            <div className="flex flex-col">
              <label className="text-[#45464d] text-xs tracking-[1.2px] font-semibold mb-1" style={{ fontFamily: "Inter, sans-serif" }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Juan dela Cruz"
                required
                className="bg-white border-0 border-b border-[#6b7280] px-3 py-[10px] text-base text-black placeholder-[#c6c6ce] outline-none focus:border-black transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              />
            </div>

            {/* Professional Email */}
            <div className="flex flex-col">
              <label className="text-[#45464d] text-xs tracking-[1.2px] font-semibold mb-1" style={{ fontFamily: "Inter, sans-serif" }}>
                Professional Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan.cruz@lawfirm.ph"
                required
                className="bg-white border-0 border-b border-[#6b7280] px-3 py-[10px] text-base text-black placeholder-[#c6c6ce] outline-none focus:border-black transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col">
              <label className="text-[#45464d] text-xs tracking-[1.2px] font-semibold mb-1" style={{ fontFamily: "Inter, sans-serif" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full bg-white border-0 border-b border-[#6b7280] px-3 py-[10px] pr-10 text-base text-black placeholder-[#c6c6ce] outline-none focus:border-black transition-colors"
                  style={{ fontFamily: "Inter, sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-0 bottom-2 cursor-pointer bg-transparent border-0 p-1"
                >
                  <svg className="w-[22px] h-[15px]" fill="none" viewBox="0 0 22 15">
                    <path d={svgSignupPaths.p3e801e80} fill="#C6C6CE" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-3">
              <div
                className="relative mt-1 size-4 border border-[#c6c6ce] rounded-sm bg-white cursor-pointer shrink-0"
                onClick={() => setAgreed(!agreed)}
              >
                {agreed && <div className="absolute inset-0.5 bg-black rounded-sm" />}
              </div>
              <p className="text-[#45464d] text-base leading-[26px]" style={{ fontFamily: "Inter, sans-serif" }}>
                I agree to the{" "}
                <span className="font-semibold text-black cursor-pointer">Terms of Service</span>
                {" "}and{" "}
                <span className="font-semibold text-black cursor-pointer">Privacy Policy</span>.
              </p>
            </div>

            {/* Inline error */}
            {error && (
              <p className="text-red-600 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-black text-white rounded-xl text-base tracking-[1.6px] uppercase font-semibold py-4 cursor-pointer hover:bg-gray-800 transition-colors border-0 shadow-[0px_4px_20px_-2px_rgba(11,19,43,0.05)] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {signupMutation.isPending ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
            </button>
          </form>

          {/* Footer link */}
          <div className="border-t border-[#c6c6ce] mt-12 pt-8 text-center">
            <p className="text-[#45464d] text-base" style={{ fontFamily: "Inter, sans-serif" }}>
              Already have an account?{" "}
              <button
                onClick={() => router.push("/login")}
                className="text-[#735c00] font-bold border-b border-[#735c00] cursor-pointer bg-transparent border-t-0 border-l-0 border-r-0"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                Sign In
              </button>
            </p>
          </div>

          <div className="mt-20 text-center opacity-50">
            <p className="text-[#76767e] text-[10px] tracking-[-0.5px] uppercase" style={{ fontFamily: "Inter, sans-serif" }}>
              © 2024 ILOVELAWYER PHILIPPINES. ALL RIGHTS RESERVED. PROFESSIONAL LEGAL AI SERVICES.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
