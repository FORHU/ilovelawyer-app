"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { useResetPasswordMutation, useValidateResetTokenQuery } from "@/lib/auth/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-provider";

const inputClass =
  "w-full border border-border rounded-xl border-b-2 bg-transparent px-3 py-4 text-base text-foreground placeholder-muted-foreground outline-none focus:border-brand-gold transition-colors";

function ResetPasswordContent() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const resetPasswordMutation = useResetPasswordMutation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const validateQuery = useValidateResetTokenQuery(success ? "" : token);

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const valid = newPassword.length >= 8 && /[^a-zA-Z0-9]/.test(newPassword);

  const resetError = resetPasswordMutation.error as (Error & { status?: number }) | null;
  const checkingToken = !success && !!token && validateQuery.isPending;
  const linkInvalid =
    !success &&
    (!token ||
      (validateQuery.isSuccess && !validateQuery.data.valid) ||
      validateQuery.isError ||
      (resetPasswordMutation.isError && resetError?.status === 400));

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* LEFT — fixed navy brand panel, unaffected by theme (see unified-auth.tsx) */}
      <div className="relative hidden lg:flex flex-col" style={{ width: "58%" }}>
        <div className="absolute inset-0 bg-brand-navy-950" />
        <div
          className="absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(ellipse at 40% 50%, var(--brand-navy-800) 0%, var(--brand-navy-950) 65%)" }}
        />

        {/* Logo */}
        <div className="absolute top-16 left-16 z-10">
          <p className="text-[28px] text-white tracking-[-0.7px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
            ilovelawyer
          </p>
        </div>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-start justify-center pl-16 pr-12 z-10">
          <div className="bg-brand-gold h-0.5 w-12 mb-8" />
          <h2
            className="text-white text-[56px] leading-[68px] tracking-[-1px] mb-4"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
          >
            {t("resetPassword.sideHeading")}
          </h2>
          <p className="text-[rgba(224,227,229,0.7)] text-base leading-[26px] max-w-[380px]" style={{ fontFamily: "Inter, sans-serif" }}>
            {t("resetPassword.sideDescription")}
          </p>
        </div>

        {/* Bottom quote */}
        <div className="absolute bottom-16 left-16 max-w-[400px] z-10">
          <p className="text-[rgba(255,255,255,0.5)] text-sm leading-[22px] italic" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
            &ldquo;{t("resetPassword.quote")}&rdquo;
          </p>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="relative bg-background flex flex-col items-center justify-center px-8 md:px-[106px] py-12 flex-1 overflow-y-auto">
        <div className="absolute top-6 right-6 md:top-8 md:right-10 flex items-center gap-4 text-foreground z-20">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[448px] flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-[40px] text-foreground leading-[48px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
              {checkingToken
                ? t("resetPassword.headingChecking")
                : linkInvalid
                ? t("resetPassword.headingInvalid")
                : success
                ? t("resetPassword.headingSuccess")
                : t("resetPassword.headingDefault")}
            </h1>
            <p className="text-muted-foreground text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
              {checkingToken
                ? t("resetPassword.subheadingChecking")
                : linkInvalid
                ? t("resetPassword.subheadingInvalid")
                : success
                ? t("resetPassword.subheadingSuccess")
                : t("resetPassword.subheadingDefault")}
            </p>
          </div>

          {checkingToken ? null : linkInvalid ? (
            <div className="flex flex-col gap-6">
              <div className="border border-brand-gold bg-accent px-4 py-4">
                <p className="text-foreground text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("resetPassword.invalidNotice")}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => router.push("/login?tab=recover")}
                    className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:opacity-90 transition-opacity border-0"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {t("resetPassword.requestNewLink")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Request a fresh password-reset email</TooltipContent>
              </Tooltip>
            </div>
          ) : success ? (
            <div className="flex flex-col gap-6">
              <div className="border border-brand-gold bg-accent px-4 py-4">
                <p className="text-foreground text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("resetPassword.successNotice")}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => router.push("/login")}
                    className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:opacity-90 transition-opacity border-0"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {t("resetPassword.signIn")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Go to the login page with your new password</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <form
              className="flex flex-col gap-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (!valid || !passwordsMatch || !token) return;
                resetPasswordMutation.mutate(
                  { token, password: newPassword },
                  { onSuccess: () => setSuccess(true) },
                );
              }}
            >
              <div className="flex flex-col gap-2">
                <label className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("resetPassword.newPasswordLabel")}
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("resetPassword.newPasswordPlaceholder")}
                    required
                    className={`${inputClass} pr-10`}
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        aria-label={showNew ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{showNew ? "Hide password" : "Show password"}</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("resetPassword.confirmPasswordLabel")}
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                    required
                    className={`${inputClass} pr-10`}
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{showConfirm ? "Hide password" : "Show password"}</TooltipContent>
                  </Tooltip>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="text-red-500 text-xs" style={{ fontFamily: "Inter, sans-serif" }}>{t("resetPassword.passwordsMismatch")}</p>
                )}
              </div>

              {resetPasswordMutation.isError && resetError?.status !== 400 && (
                <p className="text-red-500 text-xs" style={{ fontFamily: "Inter, sans-serif" }}>
                  {resetError?.message || t("resetPassword.genericError")}
                </p>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="submit"
                    disabled={!valid || !passwordsMatch || !token || resetPasswordMutation.isPending}
                    className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {resetPasswordMutation.isPending ? t("resetPassword.resetting") : t("resetPassword.resetPassword")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Save your new password and secure your account</TooltipContent>
              </Tooltip>
            </form>
          )}

          <div className="flex items-center justify-between border-t border-border pt-8">
            <span className="text-muted-foreground text-xs tracking-[1.2px] font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => router.push("/login")}
                  className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold cursor-pointer bg-transparent border-0 hover:text-foreground transition-colors"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {t("footer.signIn")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Return to the login screen</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
