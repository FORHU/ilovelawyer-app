"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useResetPasswordMutation, useValidateResetTokenQuery } from "@/lib/auth/mutations";

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
    <div className="flex h-screen w-full overflow-hidden bg-[#f7fafc]">
      {/* LEFT — dark panel */}
      <div className="relative hidden lg:flex flex-col" style={{ width: "58%" }}>
        <div className="absolute inset-0 bg-[#131a33]" />
        <div className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(ellipse at 40% 50%, #1e2d4a 0%, #131a33 65%)" }} />
        <div className="absolute inset-0 bg-[rgba(19,26,51,0.3)]" />

        {/* Logo */}
        <div className="absolute top-16 left-16 z-10">
          <p className="text-[28px] text-white tracking-[-0.7px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
            ilovelawyer
          </p>
        </div>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-start justify-center pl-16 pr-12 z-10">
          <div className="bg-[#cca830] h-0.5 w-12 mb-8" />
          <h2
            className="text-[#f7fafc] text-[56px] leading-[68px] tracking-[-1px] mb-4"
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
      <div className="bg-white flex flex-col items-center justify-center px-8 md:px-[106px] py-12 flex-1 overflow-y-auto">
        <div className="w-full max-w-[448px] flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-[40px] text-black leading-[48px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
              {checkingToken
                ? t("resetPassword.headingChecking")
                : linkInvalid
                ? t("resetPassword.headingInvalid")
                : success
                ? t("resetPassword.headingSuccess")
                : t("resetPassword.headingDefault")}
            </h1>
            <p className="text-[#45464d] text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
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
              <div className="border border-[#cca830] bg-[#fdf8ec] px-4 py-4">
                <p className="text-[#735c00] text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("resetPassword.invalidNotice")}
                </p>
              </div>
              <button
                onClick={() => router.push("/forgot-password")}
                className="w-full bg-black text-white text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors border-0"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {t("resetPassword.requestNewLink")}
              </button>
            </div>
          ) : success ? (
            <div className="flex flex-col gap-6">
              <div className="border border-[#cca830] bg-[#fdf8ec] px-4 py-4">
                <p className="text-[#735c00] text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("resetPassword.successNotice")}
                </p>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-black text-white text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors border-0"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {t("resetPassword.signIn")}
              </button>
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
                <label className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("resetPassword.newPasswordLabel")}
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("resetPassword.newPasswordPlaceholder")}
                    required
                    className="w-full border border-[#c6c6ce] border-b-2 bg-transparent px-3 py-4 text-base text-black placeholder-[#6b7280] outline-none focus:border-[#cca830] transition-colors pr-10"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1"
                  >
                    
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[#45464d] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("resetPassword.confirmPasswordLabel")}
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                    required
                    className="w-full border border-[#c6c6ce] border-b-2 bg-transparent px-3 py-4 text-base text-black placeholder-[#6b7280] outline-none focus:border-[#cca830] transition-colors pr-10"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-1"
                  >
                    
                  </button>
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

              <button
                type="submit"
                disabled={!valid || !passwordsMatch || !token || resetPasswordMutation.isPending}
                className="w-full bg-black text-white text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {resetPasswordMutation.isPending ? t("resetPassword.resetting") : t("resetPassword.resetPassword")}
              </button>
            </form>
          )}

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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
