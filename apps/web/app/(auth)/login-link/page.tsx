"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useConsumeLoginLinkMutation } from "@/lib/auth/mutations";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { LoadingScreen } from "@/components/loading-screen";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

function LoginLinkContent() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const consumeLoginLinkMutation = useConsumeLoginLinkMutation();
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    consumeLoginLinkMutation.mutate(
      { token },
      { onSuccess: () => router.replace("/homepage") },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const invalid = !token || consumeLoginLinkMutation.isError;

  if (!invalid) return <LoadingScreen />;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="relative hidden lg:flex flex-col" style={{ width: "58%" }}>
        <div className="absolute inset-0 bg-brand-navy-950" />
        <div
          className="absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(ellipse at 40% 50%, var(--brand-navy-800) 0%, var(--brand-navy-950) 65%)" }}
        />
        <div className="absolute top-16 left-16 z-10">
          <Logo forBackground="dark" size={40} />
        </div>
      </div>

      <div className="relative bg-background flex flex-col items-center justify-center px-8 md:px-[106px] py-12 flex-1 overflow-y-auto">
        <div className="absolute top-6 right-6 md:top-8 md:right-10 flex items-center gap-4 text-foreground z-20">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[448px] flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-[40px] text-foreground leading-[48px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
              {t("loginLink.headingInvalid")}
            </h1>
            <p className="text-muted-foreground text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
              {t("loginLink.subheadingInvalid")}
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="border border-brand-gold bg-accent px-4 py-4">
              <p className="text-foreground text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("loginLink.invalidNotice")}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => router.push("/login")}
                  className="w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[3.2px] uppercase py-4 cursor-pointer hover:opacity-90 transition-opacity border-0"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {t("loginLink.goToLogin")}
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

export default function LoginLinkPage() {
  return (
    <Suspense>
      <LoginLinkContent />
    </Suspense>
  );
}
