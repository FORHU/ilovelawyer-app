
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { useTenantCodeHint } from "@/components/tenant-code-provider";
import { getTenantCodeConfig } from "@/config/tenant-codes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { isPasswordValid } from "@/lib/auth/password-policy";
import { TermsReviewDialog } from "./terms-review-dialog";
import { WorkspaceSetup } from "./workspace-setup";

import {
  sanitizeNextPath,
  type OrganizationStatus,
  useCancelSignupMutation,
  useForgotPasswordMutation,
  useGoogleAuthMutation,
  useGoogleLinkMutation,
  useLoginMutation,
  useLogoutMutation,
  useSendOtpMutation,
  useSignupMutation,
  useUpdateRequiredPasswordMutation,
  useVerifyOtpMutation,
} from "@/lib/auth/mutations";

type Tab = "signin" | "signup" | "recover";

const OTP_LENGTH = 6;
// Where an invited user with no organization yet goes to accept their invite.
const ORGANIZATION_PATH = "/homepage/organization";
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

  // Forced one-time password update — a 428 from login() means this account predates the
  // current password policy. signinPassword doubles as the "current password" proof here.
  const [passwordUpdateRequired, setPasswordUpdateRequired] = useState(false);
  const [requiredNewPassword, setRequiredNewPassword] = useState("");
  const [requiredConfirmPassword, setRequiredConfirmPassword] = useState("");
  const [showRequiredNewPw, setShowRequiredNewPw] = useState(false);
  const [showRequiredConfirmPw, setShowRequiredConfirmPw] = useState(false);

  // Sign up fields
  const [name, setName] = useState("");
  // Prefilled from an org-invite email's sign-up link (?email=), which was sent to that address.
  const [signupEmail, setSignupEmail] = useState(() => searchParams.get("email") ?? "");
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
  // The Tenant auto-approved the account at verification — after workspace setup the user
  // is signed out and asked to sign in again, instead of going straight into the app.
  const [signInAfterSetup, setSignInAfterSetup] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Google sign-in. The popup's onSuccess is a single callback shared by both tabs, so which
  // tab launched it — and the remember/Terms choices in effect at that moment — are captured
  // in refs by launchGoogle rather than read from (possibly stale) state inside the callback.
  const googleTokenRef = useRef<string | null>(null);
  const googleRememberRef = useRef(true);
  const googleAcceptedTermsRef = useRef(false);
  // Sign-up tab's Google button clicked before agreeing — resume the popup once they agree.
  const googleAfterTermsRef = useRef(false);
  // A 428 TERMS_ACCEPTANCE_REQUIRED (a brand-new Google identity, e.g. from the sign-in tab)
  // opens its own Terms dialog; this tells its close handler whether it closed by agreeing.
  const [googleTermsOpen, setGoogleTermsOpen] = useState(false);
  const googleTermsAgreedRef = useRef(false);
  // Set by a GOOGLE_LINK_REQUIRED 409 — the existing password account's email, which the
  // link step asks the password for.
  const [googleLinkEmail, setGoogleLinkEmail] = useState<string | null>(null);
  const [linkPassword, setLinkPassword] = useState("");
  const [showLinkPw, setShowLinkPw] = useState(false);

  const loginMutation = useLoginMutation();
  const updateRequiredPasswordMutation = useUpdateRequiredPasswordMutation();
  const signupMutation = useSignupMutation();
  const googleMutation = useGoogleAuthMutation();
  const googleLinkMutation = useGoogleLinkMutation();
  const forgotPasswordMutation = useForgotPasswordMutation();
  const sendOtpMutation = useSendOtpMutation();
  const verifyOtpMutation = useVerifyOtpMutation();
  const cancelSignupMutation = useCancelSignupMutation();
  const logoutMutation = useLogoutMutation();


  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  function selectTab(next: Tab) {
    setTab(next);
    setError(null);
    // Keeps the other params (an invite link's next/email) so switching tabs doesn't lose them.
    const params = new URLSearchParams(searchParams.toString());
    if (next === "signin") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `/login?${query}` : "/login", { scroll: false });
  }

  /** A Google user with no organization yet (new, or one who abandoned onboarding) goes
   * through the same WorkspaceSetup step as a freshly-verified password signup; everyone else
   * continues to `next`, or to the Organization page when an invite is waiting. "unknown" (the
   * org lookup failed) also continues — the protected layout re-checks from there. */
  function finishGoogleAuth(data: { user: { name?: string | null }; organizationStatus: OrganizationStatus }) {
    googleTokenRef.current = null;
    if (data.organizationStatus === "none") {
      setName(data.user.name ?? "");
      setWorkspaceStep(true);
      return;
    }
    router.push(data.organizationStatus === "invited" ? ORGANIZATION_PATH : sanitizeNextPath(searchParams.get("next")));
  }

  /** Password sign-in counterpart of finishGoogleAuth — the mutation already navigated
   * unless the user has no organization, in which case they get the (skippable)
   * WorkspaceSetup step. */
  function finishPasswordAuth(data: { user: { name?: string | null }; organizationStatus: OrganizationStatus }) {
    if (data.organizationStatus !== "none") return;
    setName(data.user.name ?? "");
    setWorkspaceStep(true);
  }

  function submitGoogle(idToken: string, acceptedTerms: boolean) {
    setError(null);
    googleMutation.mutate(
      { idToken, remember: googleRememberRef.current, acceptedTerms },
      {
        onSuccess: finishGoogleAuth,
        onError: (err) => {
          const { code, body } = err as Error & { code?: string; body?: { email?: string } };
          // Brand-new Google identity with no Terms acceptance yet — nothing was created.
          // Keep the token and retry with it once they agree (see the second
          // TermsReviewDialog below), rather than sending them through the popup again.
          if (code === "TERMS_ACCEPTANCE_REQUIRED") {
            googleTermsAgreedRef.current = false;
            setGoogleTermsOpen(true);
            return;
          }
          // An existing password account owns this email — offer to connect Google to it,
          // which requires that account's password (AuthSvc.linkGoogle).
          if (code === "GOOGLE_LINK_REQUIRED" && body?.email) {
            setLinkPassword("");
            setGoogleLinkEmail(body.email);
            return;
          }
          googleTokenRef.current = null;
          setError((err as Error).message);
        },
      }
    );
  }

  const googleLogin = useGoogleLogin({
    onSuccess: ({ access_token }) => {
      googleTokenRef.current = access_token;
      submitGoogle(access_token, googleAcceptedTermsRef.current);
    },
    onError: () => setError(t("login.googleError")),
  });

  /** The sign-in tab honors its Remember checkbox; the sign-up tab always remembers, same as
   * a password signup's verify-otp session. The sign-up tab also requires the Terms first —
   * if not yet agreed, the Terms dialog opens and its onAgree resumes the popup. */
  function launchGoogle(source: "signin" | "signup") {
    setError(null);
    googleRememberRef.current = source === "signin" ? remember : true;
    if (source === "signup" && !agreed) {
      googleAfterTermsRef.current = true;
      setTermsDialogOpen(true);
      return;
    }
    googleAcceptedTermsRef.current = source === "signup";
    googleLogin();
  }

  function handleGoogleTermsOpenChange(open: boolean) {
    setGoogleTermsOpen(open);
    if (!open && !googleTermsAgreedRef.current) {
      googleTokenRef.current = null;
      setError(t("login.googleTermsDeclined"));
    }
  }

  function exitGoogleLink() {
    googleTokenRef.current = null;
    setGoogleLinkEmail(null);
    setLinkPassword("");
    setShowLinkPw(false);
    setError(null);
  }

  function handleGoogleLink(e: React.SyntheticEvent) {
    e.preventDefault();
    const idToken = googleTokenRef.current;
    const linkEmail = googleLinkEmail;
    if (!idToken || !linkEmail) return;
    setError(null);
    googleLinkMutation.mutate(
      { idToken, password: linkPassword, remember: googleRememberRef.current },
      {
        onSuccess: (data) => {
          setGoogleLinkEmail(null);
          setLinkPassword("");
          finishGoogleAuth(data);
        },
        onError: (err) => {
          // Same forced-update gate as a password sign-in (see handleSignIn): the password
          // they just entered is the "current password" proof for that step. Google stays
          // unlinked; they can connect it again after updating.
          if ((err as Error & { status?: number }).status === 428) {
            setSigninEmail(linkEmail);
            setSigninPassword(linkPassword);
            setRemember(googleRememberRef.current);
            exitGoogleLink();
            setPasswordUpdateRequired(true);
            return;
          }
          setError((err as Error).message);
        },
      }
    );
  }

  function handleSignIn(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(null);
    loginMutation.mutate(
      { email: signinEmail, password: signinPassword, remember },
      {
        onSuccess: finishPasswordAuth,
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
          // 428 from login() means the account predates the current password policy —
          // signinPassword already proved they know the current password, so just ask for
          // a new one instead of bouncing them back to a blank sign-in form.
          if ((err as Error & { status?: number }).status === 428) {
            setPasswordUpdateRequired(true);
            return;
          }
          setError((err as Error).message);
        },
      }
    );
  }

  function handleUpdateRequiredPassword(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!isPasswordValid(requiredNewPassword)) {
      setError(t("signup.passwordRequirements.notMet"));
      return;
    }
    if (requiredNewPassword !== requiredConfirmPassword) {
      setError(t("signup.passwordsMismatch"));
      return;
    }
    setError(null);
    updateRequiredPasswordMutation.mutate(
      { email: signinEmail, currentPassword: signinPassword, newPassword: requiredNewPassword, remember },
      { onSuccess: finishPasswordAuth, onError: (err) => setError((err as Error).message) }
    );
  }

  function handleSignUp(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!isPasswordValid(signupPassword)) {
      setError(t("signup.passwordRequirements.notMet"));
      return;
    }
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
        onSuccess: (data) => {
          // An invite approves the account (see AuthSvc.autoApproveIfEnabled), so there's no
          // workspace to set up — they go accept it.
          if (data.organizationStatus === "invited") {
            router.push(ORGANIZATION_PATH);
            return;
          }
          setSignInAfterSetup(data.user.approvalStatus === "ACTIVE");
          setOtpStep(false);
          setWorkspaceStep(true);
        },
        onError: (err) => setError((err as Error).message),
      }
    );
  }

  function handleWorkspaceDone() {
    if (!signInAfterSetup) {
      router.push(sanitizeNextPath(searchParams.get("next")));
      return;
    }
    // Revokes the verification session (useLogoutMutation also clears auth/query state and
    // routes to /login — this same page, so the local state below survives).
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        setWorkspaceStep(false);
        setSignInAfterSetup(false);
        setSigninEmail(signupEmail);
        setSigninPassword("");
        setTab("signin");
        setError(null);
        setAccountReady(true);
      },
    });
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
    updateRequiredPasswordMutation.isPending ||
    signupMutation.isPending ||
    googleMutation.isPending ||
    googleLinkMutation.isPending ||
    sendOtpMutation.isPending ||
    verifyOtpMutation.isPending;
  
  const tabs: { key: Tab; labelKey: string; tooltip: string }[] = [
    { key: "signin", labelKey: "login.tabs.signIn", tooltip: "Switch to the sign-in form" },
    { key: "signup", labelKey: "login.tabs.signUp", tooltip: "Switch to the sign-up form" },
    { key: "recover", labelKey: "login.tabs.recover", tooltip: "Switch to the password recovery form" },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* LEFT — fixed navy brand panel, unaffected by theme (see reset-password/page.tsx) */}
      <div className="relative hidden lg:flex flex-col" style={{ width: "58%" }}>
        <div className="absolute inset-0 bg-brand-navy-950" />
        <div
          className="absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(ellipse at 40% 50%, var(--brand-navy-800) 0%, var(--brand-navy-950) 65%)" }}
        />

        <div className="absolute top-16 left-16 z-10">
          <Logo forBackground="dark" size={40} />
        </div>

        <div className="absolute inset-0 flex flex-col items-start justify-center pl-16 pr-12 z-10">
          <div className="bg-brand-gold h-0.5 w-12 mb-8" />
          <blockquote className="font-['Libre_Caslon_Text'] italic text-white text-[24px] leading-9.5 max-w-100 mb-5">
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
            <WorkspaceSetup defaultOrgName={name} onDone={handleWorkspaceDone} />
          ) : otpStep ? (
            <>
              <div className="flex flex-col gap-1 pt-20">
                <h1
                  className="font-['Libre_Caslon_Text'] font-normal text-[40px] text-foreground leading-12"
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
                          // Fire-and-forget — this signup attempt was never verified, so
                          // there's nothing worth blocking navigation on; a failed cancel
                          // call just leaves the abandoned row for a later attempt's
                          // duplicate-email check/race-safe insert to handle instead (see
                          // AuthSvc.signup's P2002 guard).
                          if (signupEmail) cancelSignupMutation.mutate({ email: signupEmail });
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
          ) : googleLinkEmail ? (
            <>
              <div className="flex flex-col gap-1 pt-20">
                <h1 className="font-['Libre_Caslon_Text'] font-normal text-[40px] text-foreground leading-12">
                  {t("googleLink.heading")}
                </h1>
                <p className="text-muted-foreground text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("googleLink.subheadingPrefix")} <span className="font-semibold text-foreground">{googleLinkEmail}</span>
                  {t("googleLink.subheadingSuffix")}
                </p>
              </div>

              <form onSubmit={handleGoogleLink} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label
                    className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {t("googleLink.passwordLabel")}
                  </label>
                  <div className="relative">
                    <input
                      type={showLinkPw ? "text" : "password"}
                      value={linkPassword}
                      onChange={(e) => setLinkPassword(e.target.value)}
                      placeholder={t("login.passwordPlaceholder")}
                      required
                      autoFocus
                      className={`${inputClass} pr-10`}
                      style={{ fontFamily: "Inter, sans-serif" }}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setShowLinkPw(!showLinkPw)}
                          aria-label={showLinkPw ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showLinkPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{showLinkPw ? "Hide password" : "Show password"}</TooltipContent>
                    </Tooltip>
                  </div>
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
                      disabled={isPending || !linkPassword}
                      className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[1.6px] uppercase font-semibold py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {googleLinkMutation.isPending ? t("googleLink.connecting") : t("googleLink.connect")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Confirm your password to connect Google sign-in to this account</TooltipContent>
                </Tooltip>

                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          const linkEmail = googleLinkEmail;
                          exitGoogleLink();
                          setRecoverEmail(linkEmail);
                          setRecoverSent(false);
                          selectTab("recover");
                        }}
                        className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold cursor-pointer bg-transparent border-0 hover:text-foreground transition-colors"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {t("googleLink.forgotPassword")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Recover access to your account</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          exitGoogleLink();
                          selectTab("signin");
                        }}
                        className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold cursor-pointer bg-transparent border-0 hover:text-foreground transition-colors"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {t("googleLink.back")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Return to the sign-in form</TooltipContent>
                  </Tooltip>
                </div>
              </form>
            </>
          ) : passwordUpdateRequired ? (
            <>
              <div className="flex flex-col gap-1 pt-20">
                <h1 className="font-['Libre_Caslon_Text'] font-normal text-[40px] text-foreground leading-12">
                  {t("forcedPasswordUpdate.heading")}
                </h1>
                <p className="text-muted-foreground text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("forcedPasswordUpdate.subheading")}
                </p>
              </div>

              <form onSubmit={handleUpdateRequiredPassword} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label
                    className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {t("forcedPasswordUpdate.newPasswordLabel")}
                  </label>
                  <div className="relative">
                    <input
                      type={showRequiredNewPw ? "text" : "password"}
                      value={requiredNewPassword}
                      onChange={(e) => setRequiredNewPassword(e.target.value)}
                      placeholder="••••••••••"
                      required
                      autoFocus
                      className={`${inputClass} pr-10`}
                      style={{ fontFamily: "Inter, sans-serif" }}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setShowRequiredNewPw(!showRequiredNewPw)}
                          aria-label={showRequiredNewPw ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showRequiredNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{showRequiredNewPw ? "Hide password" : "Show password"}</TooltipContent>
                    </Tooltip>
                  </div>
                  {requiredNewPassword && (
                    <PasswordRequirements
                      password={requiredNewPassword}
                      labels={{
                        length: t("signup.passwordRequirements.length"),
                        uppercase: t("signup.passwordRequirements.uppercase"),
                        lowercase: t("signup.passwordRequirements.lowercase"),
                        number: t("signup.passwordRequirements.number"),
                        special: t("signup.passwordRequirements.special"),
                      }}
                    />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {t("forcedPasswordUpdate.confirmPasswordLabel")}
                  </label>
                  <div className="relative">
                    <input
                      type={showRequiredConfirmPw ? "text" : "password"}
                      value={requiredConfirmPassword}
                      onChange={(e) => setRequiredConfirmPassword(e.target.value)}
                      placeholder="••••••••••"
                      required
                      className={`${inputClass} pr-10`}
                      style={{ fontFamily: "Inter, sans-serif" }}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setShowRequiredConfirmPw(!showRequiredConfirmPw)}
                          aria-label={showRequiredConfirmPw ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showRequiredConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{showRequiredConfirmPw ? "Hide password" : "Show password"}</TooltipContent>
                    </Tooltip>
                  </div>
                  {requiredConfirmPassword && requiredNewPassword !== requiredConfirmPassword && (
                    <p className="text-red-500 text-xs" style={{ fontFamily: "Inter, sans-serif" }}>
                      {t("signup.passwordsMismatch")}
                    </p>
                  )}
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
                      disabled={
                        isPending ||
                        !isPasswordValid(requiredNewPassword) ||
                        (requiredConfirmPassword !== "" && requiredNewPassword !== requiredConfirmPassword)
                      }
                      className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[1.6px] uppercase font-semibold py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {updateRequiredPasswordMutation.isPending
                        ? t("forcedPasswordUpdate.updating")
                        : t("forcedPasswordUpdate.updatePassword")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Save your new password and continue signing in</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordUpdateRequired(false);
                        setRequiredNewPassword("");
                        setRequiredConfirmPassword("");
                        setError(null);
                      }}
                      className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold cursor-pointer bg-transparent border-0 hover:text-foreground transition-colors self-center"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {t("forcedPasswordUpdate.back")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Return to the sign-in form</TooltipContent>
                </Tooltip>
              </form>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1 pt-20">
                <h1
                  className="font-['Libre_Caslon_Text'] font-normal text-[40px] text-foreground leading-12"
                >
                  {tab === "signup" ? t("signup.heading") : tab === "recover" ? (recoverSent ? t("forgotPassword.headingSent") : t("forgotPassword.headingDefault")) : t("login.heading")}
                </h1>
                {tab !== "signup" && (
                  <p className="text-muted-foreground text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
                    {tab === "recover" ? (recoverSent ? t("forgotPassword.subheadingSent") : t("forgotPassword.subheadingDefault")) : t("login.subheading")}
                  </p>
                )}
              </div>

              {(legacySignupSuccess || accountReady) && tab === "signin" && (
                <div className="border border-brand-gold bg-accent px-4 py-3">
                  <p className="text-foreground text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                    {accountReady ? t("login.accountReady") : t("login.signupSuccess")}
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
                        onClick={() => launchGoogle("signin")}
                        className="w-full bg-background border border-border rounded-xl flex items-center justify-center gap-3 px-px py-4.25 cursor-pointer hover:bg-accent dark:hover:bg-overlay-hover dark:hover:bg-overlay-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        onClick={() => launchGoogle("signup")}
                        className="w-full bg-background border border-border rounded-xl flex items-center justify-center gap-3 px-px py-4.25 cursor-pointer hover:bg-accent dark:hover:bg-overlay-hover dark:hover:bg-overlay-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                          onChange={(e) => {
                            setSignupPassword(e.target.value);
                            // The toggle disappears with the last character — re-mask so the next
                            // entry doesn't start out revealed with no visible way to hide it.
                            if (!e.target.value) setShowSignupPw(false);
                          }}
                          placeholder={t("signup.passwordPlaceholder")}
                          required
                          className={`${inputClass} pr-10`}
                          style={{ fontFamily: "Inter, sans-serif" }}
                        />
                        {/* Only offered once there's something to reveal. */}
                        {signupPassword && (
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
                        )}
                      </div>
                      {signupPassword && (
                        <PasswordRequirements
                          password={signupPassword}
                          labels={{
                            length: t("signup.passwordRequirements.length"),
                            uppercase: t("signup.passwordRequirements.uppercase"),
                            lowercase: t("signup.passwordRequirements.lowercase"),
                            number: t("signup.passwordRequirements.number"),
                            special: t("signup.passwordRequirements.special"),
                          }}
                        />
                      )}
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
                          onChange={(e) => {
                            setConfirmSignupPassword(e.target.value);
                            if (!e.target.value) setShowConfirmSignupPw(false);
                          }}
                          placeholder={t("signup.confirmPasswordPlaceholder")}
                          required
                          className={`${inputClass} pr-10`}
                          style={{ fontFamily: "Inter, sans-serif" }}
                        />
                        {confirmSignupPassword && (
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
                        )}
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
                            className={`relative mt-1 size-5 border-2 border-foreground/40 rounded-sm bg-background cursor-pointer shrink-0 hover:border-brand-gold transition-colors ${!hasReadTerms ? "opacity-50" : ""}`}
                            onClick={() => (hasReadTerms ? setAgreed(!agreed) : setTermsDialogOpen(true))}
                          >
                            {agreed && <div className="absolute inset-0.5 bg-foreground rounded-[1px]" />}
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
                      onOpenChange={(open) => {
                        setTermsDialogOpen(open);
                        if (!open) googleAfterTermsRef.current = false;
                      }}
                      onAgree={() => {
                        setHasReadTerms(true);
                        setAgreed(true);
                        // Opened by the sign-up tab's Google button — resume it. Still inside
                        // the Agree click, so the browser treats the popup as user-initiated.
                        if (googleAfterTermsRef.current) {
                          googleAfterTermsRef.current = false;
                          googleAcceptedTermsRef.current = true;
                          googleLogin();
                        }
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
                          disabled={
                            isPending ||
                            !isPasswordValid(signupPassword) ||
                            (confirmSignupPassword !== "" && signupPassword !== confirmSignupPassword)
                          }
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
                            onSuccess: () => {
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

          <TermsReviewDialog
            open={googleTermsOpen}
            onOpenChange={handleGoogleTermsOpenChange}
            onAgree={() => {
              googleTermsAgreedRef.current = true;
              setHasReadTerms(true);
              setAgreed(true);
              if (googleTokenRef.current) submitGoogle(googleTokenRef.current, true);
            }}
          />

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
