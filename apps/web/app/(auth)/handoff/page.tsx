"use client";

// Lands here with a one-time handoff code from the user's other client on this PC (desktop app →
// browser, or browser → desktop app) and trades it for a login of this client's own — see
// lib/desktop/handoff.ts.
//
// It asks first. The code arrives in a link, and a link can be crafted: someone could send a code
// for *their own* account, which would silently switch this app or browser to it. So the page
// previews whose code it is (without using it up) and asks "Sign in as …?" — unless this client
// is already signed in as that same account, where nothing would change.

import { Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useConsumeHandoffMutation, useHandoffPreviewQuery } from "@/lib/auth/mutations";
import { isDesktop } from "@/lib/desktop";
import { safeNextPath } from "@/lib/desktop/handoff";
import { useAuthStore } from "@/lib/store/auth.store";
import { Logo } from "@/components/logo";
import { LoadingScreen } from "@/components/loading-screen";

const noSubscribe = () => () => {};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-8">
      <div className="flex w-full max-w-[448px] flex-col gap-8">
        <Logo size={36} />
        {children}
      </div>
    </div>
  );
}

function HandoffContent() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const next = safeNextPath(searchParams.get("next"));
  const currentUser = useAuthStore((s) => s.user);
  const inDesktopApp = useSyncExternalStore(noSubscribe, isDesktop, () => false);

  const preview = useHandoffPreviewQuery(code);
  const consumeHandoff = useConsumeHandoffMutation();
  const consumed = useRef(false);

  const signIn = () => {
    if (consumed.current) return;
    consumed.current = true;
    // replace, not push: the code is single-use, so Back must never land on this page again.
    consumeHandoff.mutate({ code }, { onSuccess: () => router.replace(next) });
  };

  // Already signed in as the account the code is for: nothing would switch, so no question.
  const sameAccount = !!preview.data && currentUser?.id === preview.data.id;
  useEffect(() => {
    if (sameAccount) signIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sameAccount]);

  const invalid = !code || preview.isError || consumeHandoff.isError;
  if (invalid) {
    return (
      <Shell>
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] leading-[40px] text-foreground" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
            {t("handoff.headingInvalid")}
          </h1>
          <p className="text-base text-muted-foreground">{t("handoff.subheadingInvalid")}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full cursor-pointer rounded-xl border-0 bg-primary py-4 text-base uppercase tracking-[3.2px] text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t("handoff.goToLogin")}
        </button>
      </Shell>
    );
  }

  if (!preview.data || sameAccount || consumeHandoff.isPending || consumeHandoff.isSuccess) return <LoadingScreen />;

  const account = preview.data.name ?? preview.data.username;
  return (
    <Shell>
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] leading-[40px] text-foreground" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
          {t("handoff.confirmHeading", { account })}
        </h1>
        <p className="text-sm text-muted-foreground">{preview.data.email}</p>
        <p className="text-base text-muted-foreground">
          {inDesktopApp ? t("handoff.confirmBodyDesktop") : t("handoff.confirmBodyBrowser")}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          // Leaves without using the code — it simply expires.
          onClick={() => router.replace(currentUser ? "/homepage" : "/login")}
          className="flex-1 cursor-pointer rounded-xl border border-border bg-background py-4 text-base uppercase tracking-[3.2px] text-foreground transition-colors hover:bg-accent"
        >
          {t("handoff.cancel")}
        </button>
        <button
          type="button"
          onClick={signIn}
          className="flex-1 cursor-pointer rounded-xl border-0 bg-primary py-4 text-base uppercase tracking-[3.2px] text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t("handoff.continue")}
        </button>
      </div>
    </Shell>
  );
}

export default function HandoffPage() {
  return (
    <Suspense>
      <HandoffContent />
    </Suspense>
  );
}
