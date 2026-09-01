"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-provider";
import { useTenantCodeHint } from "@/components/tenant-code-provider";
import { getTenantCodeConfig } from "@/config/tenant-codes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { TermsReviewDialog } from "./terms-review-dialog";
import { WorkspaceSetup } from "./workspace-setup";

import {
  useForgotPasswordMutation,
  useGoogleAuthMutation,
  useLoginMutation,
  useSendOtpMutation,
  useSignupMutation,
  useVerifyOtpMutation,
} from "@/lib/auth/mutations";

type Tab = "signin" | "signup" | "recover";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

function tabFromParam(value: string | null): Tab {
  if (value === "signup") return "signup";
  if (value === "recover") return "recover";
  return "signin";
}

const inputClass =
  "w-full border border-border rounded-xl border-b-2 bg-transparent px-3 py-4 text-base text-foreground placeholder-muted-foreground outline-none focus:border-brand-gold transition-colors";

function UnifiedAuthContent() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacySignupSuccess = searchParams.get("signup") === "success";

  const [tab, setTab] = useState<Tab>(() => tabFromParam(searchParams.get("tab")));
  const [error, setError] = useState<string | null>(null);
  const tenantCodeHint = useTenantCodeHint();
  const tenantCodeConfig = getTenantCodeConfig(tenantCodeHint);

  // Sign in fields
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showSigninPw, setShowSigninPw] = useState(false);

  // Sign up fields
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmSignupPassword, setConfirmSignupPassword] = useState("");
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirmSignupPw, setShowConfirmSignupPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  // Recover fields
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverSent, setRecoverSent] = useState(false);

  // Post-signup OTP step
  const [otpStep, setOtpStep] = useState(false);
  // Post-verification workspace step (solo / create org / join org)
  const [workspaceStep, setWorkspaceStep] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const loginMutation = useLoginMutation();
  const signupMutation = useSignupMutation();
  const googleMutation = useGoogleAuthMutation();
  const forgotPasswordMutation = useForgotPasswordMutation();
  const sendOtpMutation = useSendOtpMutation();
  const verifyOtpMutation = useVerifyOtpMutation();


  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  function selectTab(next: Tab) {
    setTab(next);
    setError(null);
    router.replace(next === "signin" ? "/login" : `/login?tab=${next}`, { scroll: false });
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

  function handleSignIn(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(null);
    loginMutation.mutate(
      { email: signinEmail, password: signinPassword, remember },
      {
        onError: (err) => {
          // 403 from login() means the account exists but hasn't completed
          // email verification yet — drop them into the same OTP screen
          // signup uses (reusing signupEmail, the state it already reads)
          // and send a fresh code, rather than just showing an error.
          if ((err as Error & { status?: number }).status === 403) {
            setSignupEmail(signinEmail);
            setOtpDigits(Array(OTP_LENGTH).fill(""));
            setOtpStep(true);
            sendOtpMutation.mutate(
              { email: signinEmail },
              {
                onSuccess: () => setResendCooldown(RESEND_COOLDOWN_SECONDS),
                onError: (otpErr) => setError((otpErr as Error).message),
              }
            );
            return;
          }
          setError((err as Error).message);
        },
      }
    );
  }

  function handleSignUp(e: React.SyntheticEvent) {
    e.preventDefault();
    if (signupPassword !== confirmSignupPassword) {
      setError(t("signup.passwordsMismatch"));
      return;
    }
    if (!agreed) {
      setError(t("signup.agreementRequired"));
      return;
    }
    setError(null);
    signupMutation.mutate(
      { name, email: signupEmail, password: signupPassword },
      {
        onSuccess: () => {
          setOtpDigits(Array(OTP_LENGTH).fill(""));
          setOtpStep(true);
          sendOtpMutation.mutate(
            { email: signupEmail },
            {
              onSuccess: () => setResendCooldown(RESEND_COOLDOWN_SECONDS),
              onError: (err) => setError((err as Error).message),
            }
          );
        },
        onError: (err) => setError((err as Error).message),
      }
    );
  }

  function handleOtpDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    setOtpDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < pasted.length && index + i < OTP_LENGTH; i++) {
        next[index + i] = pasted.charAt(i);
      }
      return next;
    });
    const nextIndex = Math.min(index + pasted.length, OTP_LENGTH - 1);
    otpRefs.current[nextIndex]?.focus();
  }

  function handleVerifyOtp() {
    setError(null);
    verifyOtpMutation.mutate(
      { email: signupEmail, code: otpDigits.join("") },
      {
        onSuccess: () => {
          setOtpStep(false);
          setWorkspaceStep(true);
        },
        onError: (err) => setError((err as Error).message),
      }
    );
  }

  function handleResendOtp() {
    if (resendCooldown > 0) return;
    setError(null);
    sendOtpMutation.mutate(
      { email: signupEmail },
      {
        onSuccess: () => setResendCooldown(RESEND_COOLDOWN_SECONDS),
        onError: (err) => setError((err as Error).message),
      }
    );
  }

  const otpComplete = otpDigits.every((d) => d !== "");
  const isPending =
    loginMutation.isPending ||
    signupMutation.isPending ||
    googleMutation.isPending ||
    sendOtpMutation.isPending ||
    verifyOtpMutation.isPending;
  
  const tabs: { key: Tab; labelKey: string; tooltip: string }[] = [
    { key: "signin", labelKey: "login.tabs.signIn", tooltip: "Switch to the sign-in form" },
    { key: "signup", labelKey: "login.tabs.signUp", tooltip: "Switch to the sign-up form" },
    { key: "recover", labelKey: "login.tabs.recover", tooltip: "Switch to the password recovery form" },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* LEFT — fixed navy brand panel, unaffected by theme */}
      <div className="relative hidden lg:flex flex-col" style={{ width: "58%" }}>
        <div className="absolute inset-0 bg-[#1a1f23]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(ellipse at 30% 60%, #1c61a5 0%, transparent 70%)" }}
        />
        <div className="absolute inset-0 bg-[rgba(88,79,79,0.35)]" />

        <div className="absolute top-16 left-16 z-10">
          <p
            className="text-[28px] text-white tracking-[-0.7px]"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
          >
            ilovelawyer
          </p>
        </div>

        <div className="absolute inset-0 flex flex-col items-start justify-center pl-16 pr-12 z-10">
          <div className="bg-brand-gold h-0.5 w-12 mb-8" />
          <blockquote
            className="text-white text-[24px] leading-9.5 max-w-100 mb-5"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontStyle: "italic" }}
          >
            &ldquo;{t("login.quote")}&rdquo;
          </blockquote>
          <p
            className="text-[rgba(224,227,229,0.45)] text-[11px] tracking-[2.5px] uppercase"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {t("login.quoteAuthor")}
          </p>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="relative bg-background flex flex-col items-center justify-start px-8 md:px-26.5 py-10 flex-1 overflow-y-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => router.push("/")}
              aria-label={t("login.backToHome", { defaultValue: "Back to home" })}
              className="absolute top-6 left-6 md:top-8 md:left-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 z-20"
            >
              <ArrowLeft size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("login.backToHome", { defaultValue: "Back to home" })}</TooltipContent>
        </Tooltip>

        <div className="absolute top-6 right-6 md:top-8 md:right-10 flex items-center gap-4 text-foreground z-20">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md flex flex-col gap-8 my-auto">
          {workspaceStep ? (
            <WorkspaceSetup defaultOrgName={name} onDone={() => router.push("/homepage")} />
          ) : otpStep ? (
            <>
              <div className="flex flex-col gap-1">
                <h1
                  className="text-[40px] text-foreground leading-12"
                  style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
                >
                  {t("otp.heading")}
                </h1>
                <p className="text-muted-foreground text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("otp.subheadingPrefix")} <span className="font-semibold text-foreground">{signupEmail}</span>
                </p>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex w-full justify-between gap-3">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onPaste={(e) => handleOtpPaste(i, e)}
                      className="w-12 h-14 text-center text-xl font-semibold border border-border rounded-xl border-b-2 bg-transparent text-foreground outline-none focus:border-brand-gold transition-colors"
                    />
                  ))}
                </div>

                {error && (
                  <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                    {error}
                  </p>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={!otpComplete || isPending}
                      onClick={handleVerifyOtp}
                      className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {verifyOtpMutation.isPending ? t("otp.verifying") : t("otp.verify")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Confirm the 6-digit code sent to your email</TooltipContent>
                </Tooltip>

                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendCooldown > 0 || sendOtpMutation.isPending}
                        className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold cursor-pointer bg-transparent border-0 hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {resendCooldown > 0 ? t("otp.resendIn", { seconds: resendCooldown }) : t("otp.resend")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Send a new verification code</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep(false);
                          selectTab("signup");
                        }}
                        className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold cursor-pointer bg-transparent border-0 hover:text-foreground transition-colors"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {t("otp.changeEmail")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Go back and correct your email address</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <h1
                  className="text-[40px] text-foreground leading-12"
                  style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
                >
                  {tab === "signup" ? t("signup.heading") : tab === "recover" ? (recoverSent ? t("forgotPassword.headingSent") : t("forgotPassword.headingDefault")) : t("login.heading")}
                </h1>
                <p className="text-muted-foreground text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
                  {tab === "signup" ? t("signup.eyebrow") : tab === "recover" ? (recoverSent ? t("forgotPassword.subheadingSent") : t("forgotPassword.subheadingDefault")) : t("login.subheading")}
                </p>
              </div>

              {legacySignupSuccess && tab === "signin" && (
                <div className="border border-brand-gold bg-accent px-4 py-3">
                  <p className="text-foreground text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                    {t("login.signupSuccess")}
                  </p>
                </div>
              )}

              {/* Tab navigation */}
              <div className="flex gap-8 border-b border-border pb-px">
                {tabs.map(({ key, labelKey, tooltip }) => {
                  const active = tab === key;
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => selectTab(key)}
                          className={`pb-3.5 text-xs tracking-[1.2px] uppercase cursor-pointer bg-transparent border-0 relative transition-colors ${
                            active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                          style={{ fontFamily: "Inter, sans-serif", fontWeight: active ? 600 : 400 }}
                        >
                          {t(labelKey)}
                          {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{tooltip}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {tab === "signin" && (
                <form onSubmit={handleSignIn} className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <label
                      className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {t("login.emailLabel")}
                    </label>
                    <input
                      type="email"
                      value={signinEmail}
                      onChange={(e) => setSigninEmail(e.target.value)}
                      placeholder={t("login.emailPlaceholder")}
                      required
                      className={inputClass}
                      style={{ fontFamily: "Inter, sans-serif" }}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {t("login.passwordLabel")}
                    </label>
                    <div className="relative">
                      <input
                        type={showSigninPw ? "text" : "password"}
                        value={signinPassword}
                        onChange={(e) => setSigninPassword(e.target.value)}
                        placeholder={t("login.passwordPlaceholder")}
                        required
                        className={`${inputClass} pr-10`}
                        style={{ fontFamily: "Inter, sans-serif" }}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setShowSigninPw(!showSigninPw)}
                            aria-label={showSigninPw ? "Hide password" : "Show password"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showSigninPw ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{showSigninPw ? "Hide password" : "Show password"}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRemember(!remember)}>
                          <div className="relative size-4 border-2 border-border bg-background shrink-0 hover:border-brand-gold transition-colors">
                            {remember && <div className="absolute inset-0.5 bg-foreground" />}
                          </div>
                          <span
                            className="text-muted-foreground text-[10px] tracking-[0.5px] uppercase"
                            style={{ fontFamily: "Inter, sans-serif" }}
                          >
                            {t("login.rememberSession")}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Stay signed in on this device</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => selectTab("recover")}
                          className="text-muted-foreground text-[10px] tracking-[0.5px] uppercase cursor-pointer bg-transparent border-0 p-0 hover:text-brand-gold transition-colors underline-offset-2 hover:underline"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          {t("login.forgotPasswordLink")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Recover access to your account</TooltipContent>
                    </Tooltip>
                  </div>

                  {error && (
                    <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                      {error}
                    </p>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {loginMutation.isPending ? t("login.signingIn") : t("login.signIn")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Log in with your email and password</TooltipContent>
                  </Tooltip>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px border-t border-border" />
                    <span
                      className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {t("login.or")}
                    </span>
                    <div className="flex-1 h-px border-t border-border" />
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => googleLogin()}
                        className="w-full bg-background border border-border rounded-xl flex items-center justify-center gap-3 px-px py-4.25 cursor-pointer hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span
                          className="text-foreground text-base tracking-[3.2px] uppercase"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          {googleMutation.isPending ? t("login.connecting") : t("login.continueWithGoogle")}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Skip the password and log in with your Google account</TooltipContent>
                  </Tooltip>
                </form>
              )}

              {tab === "signup" && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-accent/40 px-3 py-2 text-sm text-foreground">
                    <span aria-hidden="true">{tenantCodeConfig.branding.flag}</span>
                    <span style={{ fontFamily: "Inter, sans-serif" }}>{tenantCodeConfig.displayName}</span>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => googleLogin()}
                        className="w-full bg-background border border-border rounded-xl flex items-center justify-center gap-3 px-px py-4.25 cursor-pointer hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="text-foreground text-base font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                          {googleMutation.isPending ? t("signup.connecting") : t("signup.continueWithGoogle")}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Create your account instantly using Google</TooltipContent>
                  </Tooltip>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px border-t border-border" />
                    <span
                      className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {t("signup.or")}
                    </span>
                    <div className="flex-1 h-px border-t border-border" />
                  </div>

                  <form onSubmit={handleSignUp} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <label
                        className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {t("signup.fullNameLabel")}
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("signup.fullNamePlaceholder")}
                        required
                        className={inputClass}
                        style={{ fontFamily: "Inter, sans-serif" }}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label
                        className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {t("signup.emailLabel")}
                      </label>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder={t("signup.emailPlaceholder")}
                        required
                        className={inputClass}
                        style={{ fontFamily: "Inter, sans-serif" }}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label
                        className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {t("signup.passwordLabel")}
                      </label>
                      <div className="relative">
                        <input
                          type={showSignupPw ? "text" : "password"}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={8}
                          className={`${inputClass} pr-10`}
                          style={{ fontFamily: "Inter, sans-serif" }}
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setShowSignupPw(!showSignupPw)}
                              aria-label={showSignupPw ? "Hide password" : "Show password"}
                              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showSignupPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{showSignupPw ? "Hide password" : "Show password"}</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label
                        className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {t("signup.confirmPasswordLabel")}
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmSignupPw ? "text" : "password"}
                          value={confirmSignupPassword}
                          onChange={(e) => setConfirmSignupPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={8}
                          className={`${inputClass} pr-10`}
                          style={{ fontFamily: "Inter, sans-serif" }}
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setShowConfirmSignupPw(!showConfirmSignupPw)}
                              aria-label={showConfirmSignupPw ? "Hide password" : "Show password"}
                              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showConfirmSignupPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{showConfirmSignupPw ? "Hide password" : "Show password"}</TooltipContent>
                        </Tooltip>
                      </div>
                      {confirmSignupPassword && signupPassword !== confirmSignupPassword && (
                        <p className="text-red-500 text-xs" style={{ fontFamily: "Inter, sans-serif" }}>
                          {t("signup.passwordsMismatch")}
                        </p>
                      )}
                    </div>

                    <div className="flex items-start gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`relative mt-1 size-4 border border-border rounded-sm bg-background cursor-pointer shrink-0 hover:border-brand-gold transition-colors ${!hasReadTerms ? "opacity-50" : ""}`}
                            onClick={() => (hasReadTerms ? setAgreed(!agreed) : setTermsDialogOpen(true))}
                          >
                            {agreed && <div className="absolute inset-0.5 bg-foreground rounded-sm" />}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hasReadTerms ? "Agree to the Terms of Service" : t("signup.readTermsFirst")}
                        </TooltipContent>
                      </Tooltip>
                      <p className="text-muted-foreground text-base leading-6.5" style={{ fontFamily: "Inter, sans-serif" }}>
                        {t("signup.agreementPrefix")}{" "}
                        <button
                          type="button"
                          onClick={() => setTermsDialogOpen(true)}
                          className="font-semibold text-foreground cursor-pointer hover:text-brand-gold transition-colors underline-offset-2 hover:underline"
                        >
                          {t("signup.termsOfService")}
                        </button>
                        .
                      </p>
                    </div>

                    <TermsReviewDialog
                      open={termsDialogOpen}
                      onOpenChange={setTermsDialogOpen}
                      onAgree={() => {
                        setHasReadTerms(true);
                        setAgreed(true);
                      }}
                    />

                    {error && (
                      <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                        {error}
                      </p>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="submit"
                          disabled={isPending || (confirmSignupPassword !== "" && signupPassword !== confirmSignupPassword)}
                          className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[1.6px] uppercase font-semibold py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          {signupMutation.isPending ? t("signup.creatingAccount") : t("signup.createAccount")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Register your account with the details above</TooltipContent>
                    </Tooltip>
                  </form>
                </div>
              )}

              {tab === "recover" &&
                (!recoverSent ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setError(null);
                      if (recoverEmail) {
                        forgotPasswordMutation.mutate(
                          { email: recoverEmail },
                          {
                            onSuccess: (data) => {
                              // resetLink is dev-only (see useForgotPasswordMutation) — no Ethereal inbox needed locally.
                              if (data.resetLink) {
                                console.log("[dev] password reset link:", data.resetLink);
                              }
                              setRecoverSent(true);
                            },
                            onError: (err) => setError((err as Error).message),
                          }
                        );
                      }
                    }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col gap-2">
                      <label
                        className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {t("forgotPassword.emailLabel")}
                      </label>
                      <input
                        type="email"
                        value={recoverEmail}
                        onChange={(e) => setRecoverEmail(e.target.value)}
                        placeholder={t("forgotPassword.emailPlaceholder")}
                        required
                        className={inputClass}
                        style={{ fontFamily: "Inter, sans-serif" }}
                      />
                    </div>

                    {error && (
                      <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                        {error}
                      </p>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="submit"
                          disabled={forgotPasswordMutation.isPending}
                          className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          {forgotPasswordMutation.isPending ? t("forgotPassword.sending") : t("forgotPassword.sendResetLink")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Email a password-reset link to this address</TooltipContent>
                    </Tooltip>
                  </form>
                ) : (
                  <div className="flex flex-col items-center gap-8 py-4">
                    <div className="border border-brand-gold rounded-full size-20 flex items-center justify-center">
                      <Mail size={36} className="text-brand-gold" strokeWidth={1.5} />
                    </div>
                    <p
                      className="text-muted-foreground text-base leading-6.5 text-center max-w-90"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {t("forgotPassword.sentDescriptionPrefix")}{" "}
                      <span className="font-semibold text-foreground">{recoverEmail}</span>
                      {t("forgotPassword.sentDescriptionSuffix")}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => selectTab("signin")}
                          className="w-full bg-primary text-primary-foreground text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:opacity-90 transition-opacity border-0"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          {t("forgotPassword.backToSignIn")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Return to the login screen</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
            </>
          )}

          <div className="flex items-center justify-between border-t border-border pt-8">
            <span
              className="text-muted-foreground text-xs tracking-[1.2px] font-semibold"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </span>
            <div className="flex gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold underline decoration-border cursor-pointer bg-transparent border-0 hover:text-foreground transition-colors"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {t("footer.support")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Contact ilovelawyer support</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold underline decoration-border cursor-pointer bg-transparent border-0 hover:text-foreground transition-colors"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {t("footer.privacy")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>View the privacy policy</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UnifiedAuthPage() {
  return <UnifiedAuthContent />;
}
