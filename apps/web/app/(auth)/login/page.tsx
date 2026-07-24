"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { useLoginMutation, useGoogleAuthMutation } from "@/lib/auth/mutations";

function LoginContent() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const signupSuccess = searchParams.get("signup") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useLoginMutation();
  const googleMutation = useGoogleAuthMutation();

  const isPending = loginMutation.isPending || googleMutation.isPending;

  const tabs = [
    { labelKey: "login.tabs.signIn", active: true, href: null },
    { labelKey: "login.tabs.joinPlatform", active: false, href: "/signup" },
    { labelKey: "login.tabs.recover", active: false, href: "/forgot-password" },
  ] as const;

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(null);
    loginMutation.mutate(
      { email, password, remember },
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
    onError: () => setError(t("login.googleError")),
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f7fafc]">
      {/* LEFT — dark panel */}
      <div className="relative hidden lg:flex flex-col" style={{ width: "58%" }}>
        <div className="absolute inset-0 bg-[#1a1f23]" />
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at 30% 60%, #1c61a5 0%, transparent 70%)" }} />
        <div className="absolute inset-0 bg-[rgba(88, 79, 79, 0.35)]" />
        {/* Logo */}
        <div className="absolute top-16 left-16 z-10">
          <p className="text-[28px] text-white tracking-[-0.7px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
            ilovelawyer
          </p>
        </div>

        {/* Central quote */}
        <div className="absolute inset-0 flex flex-col items-start justify-center pl-16 pr-12 z-10">
          <div className="bg-[#cca830] h-0.5 w-12 mb-8" />
          <blockquote
            className="text-white text-[24px] leading-9.5 max-w-100 mb-5"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontStyle: "italic" }}
          >
            &ldquo;{t("login.quote")}&rdquo;
          </blockquote>
          <p className="text-[rgba(224,227,229,0.45)] text-[11px] tracking-[2.5px] uppercase" style={{ fontFamily: "Inter, sans-serif" }}>
            {t("login.quoteAuthor")}
          </p>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="bg-white flex flex-col items-center justify-center px-8 md:px-26.5 py-12 flex-1 overflow-y-auto">
        <div className="w-full max-w-md flex flex-col gap-10">
          <div className="flex flex-col gap-1">
            <h1 className="text-[40px] text-black leading-12" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
              {t("login.heading")}
            </h1>
            <p className="text-[#45464d] text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
              {t("login.subheading")}
            </p>
          </div>

          {signupSuccess && (
            <div className="border border-[#cca830] bg-[#fdf8ec] px-4 py-3">
              <p className="text-[#735c00] text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("login.signupSuccess")}
              </p>
            </div>
          )}

          {/* Tab navigation */}
          <div className="flex gap-8 border-b border-[rgba(198,198,206,0.3)] pb-px">
            {tabs.map(({ labelKey, active, href }) => (
              <button
                key={labelKey}
                onClick={() => href && router.push(href)}
                className={`pb-3.5 text-xs tracking-[1.2px] uppercase cursor-pointer bg-transparent border-0 relative transition-colors ${active ? "text-black" : "text-[rgba(69,70,77,0.6)] hover:text-[rgba(69,70,77,0.9)]"}`}
                style={{ fontFamily: "Inter, sans-serif", fontWeight: active ? 600 : 400 }}
              >
                {t(labelKey)}
                {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("login.emailLabel")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login.emailPlaceholder")}
                required
                className="w-full border border-[#c6c6ce] rounded-xl border-b-2 bg-transparent px-3 py-4 text-base text-black placeholder-[#6b7280] outline-none focus:border-[#cca830] focus:placeholder-transparent transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("login.passwordLabel")}
              </label>
              <div className="relative">
                <input
                  type={showPw || (!pwFocused && !password) ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                  placeholder={t("login.passwordPlaceholder")}
                  required
                  className="w-full border border-[#c6c6ce] rounded-xl border-b-2 bg-transparent px-3 py-4 text-base text-black placeholder-[#6b7280] outline-none focus:border-[#cca830] focus:placeholder-transparent transition-colors pr-10"
                  style={{ fontFamily: "Inter, sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1"
                >
                  <svg className="w-5.5 h-3.75" fill="none" viewBox="0 0 22 15">
                    <path d="M11 12C12.25 12 13.3125 11.5625 14.1875 10.6875C15.0625 9.8125 15.5 8.75 15.5 7.5C15.5 6.25 15.0625 5.1875 14.1875 4.3125C13.3125 3.4375 12.25 3 11 3C9.75 3 8.6875 3.4375 7.8125 4.3125C6.9375 5.1875 6.5 6.25 6.5 7.5C6.5 8.75 6.9375 9.8125 7.8125 10.6875C8.6875 11.5625 9.75 12 11 12ZM11 10.2C10.25 10.2 9.6125 9.9375 9.0875 9.4125C8.5625 8.8875 8.3 8.25 8.3 7.5C8.3 6.75 8.5625 6.1125 9.0875 5.5875C9.6125 5.0625 10.25 4.8 11 4.8C11.75 4.8 12.3875 5.0625 12.9125 5.5875C13.4375 6.1125 13.7 6.75 13.7 7.5C13.7 8.25 13.4375 8.8875 12.9125 9.4125C12.3875 9.9375 11.75 10.2 11 10.2ZM11 15C8.56667 15 6.35 14.3208 4.35 12.9625C2.35 11.6042 0.9 9.78333 0 7.5C0.9 5.21667 2.35 3.39583 4.35 2.0375C6.35 0.679167 8.56667 0 11 0C13.4333 0 15.65 0.679167 17.65 2.0375C19.65 3.39583 21.1 5.21667 22 7.5C21.1 9.78333 19.65 11.6042 17.65 12.9625C15.65 14.3208 13.4333 15 11 15ZM11 13C12.8833 13 14.6125 12.5042 16.1875 11.5125C17.7625 10.5208 18.9667 9.18333 19.8 7.5C18.9667 5.81667 17.7625 4.47917 16.1875 3.4875C14.6125 2.49583 12.8833 2 11 2C9.11667 2 7.3875 2.49583 5.8125 3.4875C4.2375 4.47917 3.03333 5.81667 2.2 7.5C3.03333 9.18333 4.2375 10.5208 5.8125 11.5125C7.3875 12.5042 9.11667 13 11 13Z" fill="#6b7280" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="relative size-4 border-2 border-[#c6c6ce] bg-white cursor-pointer shrink-0 hover:border-[#cca830] transition-colors"
                onClick={() => setRemember(!remember)}
              >
                {remember && <div className="absolute inset-0.5 bg-black" />}
              </div>
              <span className="text-[#45464d] text-[10px] tracking-[0.5px] uppercase" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("login.rememberSession")}
              </span>
            </div>

            {error && (
              <p className="text-red-600 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-black text-white rounded-xl text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors border-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {loginMutation.isPending ? t("login.signingIn") : t("login.signIn")}
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px border-t border-[rgba(198,198,206,0.3)]" />
              <span className="text-[rgba(69,70,77,0.5)] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>{t("login.or")}</span>
              <div className="flex-1 h-px border-t border-[rgba(198,198,206,0.3)]" />
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={() => googleLogin()}
              className="w-full bg-white border border-[#c6c6ce] rounded-xl flex items-center justify-center gap-3 px-px py-4.25 cursor-pointer hover:bg-[#f7fafc] hover:border-[#aaa] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-[#181c1e] text-base tracking-[3.2px] uppercase" style={{ fontFamily: "Inter, sans-serif" }}>
                {googleMutation.isPending ? t("login.connecting") : t("login.continueWithGoogle")}
              </span>
            </button>
          </form>

          <div className="flex items-center justify-between border-t border-[rgba(198,198,206,0.3)] pt-8">
            <span className="text-[rgba(69,70,77,0.5)] text-xs tracking-[1.2px] font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </span>
            <div className="flex gap-4">
              <button className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold underline decoration-[#c6c6ce] cursor-pointer bg-transparent border-0 hover:text-black transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("footer.support")}
              </button>
              <button className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold underline decoration-[#c6c6ce] cursor-pointer bg-transparent border-0 hover:text-black transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("footer.privacy")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
