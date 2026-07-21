"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import svgSignupPaths from "@/imports/SignUpBranding/svg-192ugpzk7r";
import { useSignupMutation, useGoogleAuthMutation } from "@/lib/auth/mutations";

export default function SignupPage() {
  const { t } = useTranslation("auth");
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
      setError(t("signup.agreementRequired"));
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
    onError: () => setError(t("signup.googleError")),
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f7fafc]">
      {/* LEFT — dark panel */}
      <div className="hidden lg:flex flex-col relative overflow-hidden" style={{ width: "58%" }}>
        <div className="absolute inset-0 bg-[#131a33]" />
        <div className="absolute inset-0 opacity-80" style={{ background: "radial-gradient(ellipse at 50% 40%, #1e2a4a 0%, #131a33 60%)" }} />
        <div className="absolute inset-0 bg-[rgba(19,26,51,0.2)]" />

        {/* Logo */}
        <div className="absolute top-16 left-16 z-10">
          <p className="text-[28px] text-white tracking-[-0.7px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
            ilovelawyer
          </p>
        </div>

        {/* Center content */}
        <div className="absolute left-16 top-1/2 translate-y-[-60%] z-10">
          <h2
            className="text-[#f7fafc] text-[64px] leading-20 tracking-[-1.28px] mb-4"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
          >
            {t("signup.sideHeading")}
          </h2>
          <div className="bg-[#cca830] h-1 w-24 mb-6" />
          <p className="text-[#e0e3e5] text-lg leading-[28.8px] opacity-80 max-w-[384px]" style={{ fontFamily: "Inter, sans-serif" }}>
            {t("signup.sideDescription")}
          </p>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="bg-white flex-1 flex flex-col items-center justify-center px-8 md:px-26.5 py-12 overflow-y-auto">
        <div className="w-full max-w-wd flex flex-col gap-10">
          <div>
            <p className="text-[#cca830] text-xs tracking-[2.4px] uppercase font-semibold mb-2" style={{ fontFamily: "Inter, sans-serif" }}>
              {t("signup.eyebrow")}
            </p>
            <h2 className="text-[40px] text-black leading-12" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
              {t("signup.heading")}
            </h2>
          </div>

          {/* Google button */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => googleLogin()}
            className="w-full bg-[#f7fafc] border border-[#c6c6ce] rounded-xl flex items-center justify-center gap-3 px-px py-4.25 cursor-pointer hover:bg-white hover:border-[#aaa] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="size-5" fill="none" viewBox="0 0 20 20">
              <path d={svgSignupPaths.p29ad9380} fill="#4285F4" />
              <path d={svgSignupPaths.p73c0a80} fill="#34A853" />
              <path d={svgSignupPaths.p15c0f980} fill="#FBBC05" />
              <path d={svgSignupPaths.p3d0b3f00} fill="#EA4335" />
            </svg>
            <span className="text-[#181c1e] text-base font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
              {googleMutation.isPending ? t("signup.connecting") : t("signup.continueWithGoogle")}
            </span>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px border-t border-[rgba(198,198,206,0.3)]" />
            <span className="text-[rgba(69,70,77,0.5)] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>{t("signup.or")}</span>
            <div className="flex-1 h-px border-t border-[rgba(198,198,206,0.3)]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("signup.fullNameLabel")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("signup.fullNamePlaceholder")}
                required
                className="w-full border border-[#c6c6ce] rounded-xl border-b-2 bg-transparent px-3 py-4 text-base text-black placeholder-[#6b7280] outline-none focus:border-[#cca830] focus:placeholder-transparent transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("signup.emailLabel")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("signup.emailPlaceholder")}
                required
                className="w-full border border-[#c6c6ce] rounded-xl border-b-2 bg-transparent px-3 py-4 text-base text-black placeholder-[#6b7280] outline-none focus:border-[#cca830] focus:placeholder-transparent transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("signup.passwordLabel")}
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full border border-[#c6c6ce] rounded-xl border-b-2 bg-transparent px-3 py-4 pr-10 text-base text-black placeholder-[#6b7280] outline-none focus:border-[#cca830] focus:placeholder-transparent transition-colors"
                  style={{ fontFamily: "Inter, sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1"
                >
                  <svg className="w-5.5 h-3.75" fill="none" viewBox="0 0 22 15">
                    <path d={svgSignupPaths.p3e801e80} fill="#6b7280" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className="relative mt-1 size-4 border border-[#c6c6ce] rounded-sm bg-white cursor-pointer shrink-0 hover:border-[#cca830] transition-colors"
                onClick={() => setAgreed(!agreed)}
              >
                {agreed && <div className="absolute inset-0.5 bg-black rounded-sm" />}
              </div>
              <p className="text-[#45464d] text-base leading-6.5" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("signup.agreementPrefix")}{" "}
                <span className="font-semibold text-black cursor-pointer hover:text-[#735c00] transition-colors">{t("signup.termsOfService")}</span>
                {" "}{t("signup.and")}{" "}
                <span className="font-semibold text-black cursor-pointer hover:text-[#735c00] transition-colors">{t("signup.privacyPolicy")}</span>.
              </p>
            </div>

            {error && (
              <p className="text-red-600 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-black text-white rounded-xl text-base tracking-[1.6px] uppercase font-semibold py-4 cursor-pointer hover:bg-gray-800 transition-colors border-0 shadow-[0px_4px_20px_-2px_rgba(11,19,43,0.05)] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {signupMutation.isPending ? t("signup.creatingAccount") : t("signup.createAccount")}
            </button>
          </form>

          <div className="flex items-center justify-between border-t border-[rgba(198,198,206,0.3)] pt-8">
            <span className="text-[rgba(69,70,77,0.5)] text-xs tracking-[1.2px] font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </span>
            <button
              onClick={() => router.push("/login")}
              className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold cursor-pointer bg-transparent border-0 hover:text-black transition-colors"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {t("footer.signIn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
