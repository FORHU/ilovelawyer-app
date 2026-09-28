"use client";

// Opened in the user's normal browser by the desktop app's "Log in with your browser" button.
// The browser is signed in (this is a protected page), so one click hands that sign-in to the
// desktop app through an ilovelawyer:// link — see lib/desktop/handoff.ts. Nothing happens
// without the click: signing another app in is the user's decision, not a page load's.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";
import { openInDesktopApp } from "@/lib/desktop/handoff";
import { useAuthStore } from "@/lib/store/auth.store";

export default function ConnectDesktopPage() {
  const { t } = useTranslation("auth");
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");

  const handOff = () => {
    openInDesktopApp("/homepage").then(
      () => setState("sent"),
      () => setState("failed"),
    );
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-8">
      <div className="flex w-full max-w-[448px] flex-col gap-8">
        <Logo size={36} />
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] leading-[40px] text-foreground" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
            {t("connectDesktop.heading")}
          </h1>
          <p className="text-base text-muted-foreground">
            {t("connectDesktop.body", { account: user?.email ?? user?.username ?? "" })}
          </p>
        </div>
        <button
          type="button"
          onClick={handOff}
          className="w-full cursor-pointer rounded-xl border-0 bg-primary py-4 text-base uppercase tracking-[3.2px] text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t("connectDesktop.continue")}
        </button>
        {state === "sent" && <p className="text-sm text-muted-foreground">{t("connectDesktop.sent")}</p>}
        {state === "failed" && <p className="text-sm text-danger">{t("connectDesktop.failed")}</p>}
      </div>
    </div>
  );
}
