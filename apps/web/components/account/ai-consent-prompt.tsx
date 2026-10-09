"use client";
import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";
import { useConsentsQuery, useSetConsentMutation } from "@/lib/user/mutations";

/** Shown once, at first login, to anyone who has not yet answered for AI processing (existing
 * accounts included). It can't be closed: choosing either button saves an answer, which is what
 * stops it coming back. The same answer stays changeable in Profile > Your Data. If the consent
 * lookup fails nothing is shown, so a hiccup never locks anyone out of the app. */
export default function AiConsentPrompt() {
  const { t } = useTranslation("profile");
  const consents = useConsentsQuery();
  const setConsent = useSetConsentMutation();

  const unanswered = consents.data?.find((c) => c.purpose === "AI_PROCESSING")?.status === "not_set";
  if (!unanswered) return null;

  const answer = (granted: boolean) => setConsent.mutate({ purpose: "AI_PROCESSING", granted, source: "first_login" });

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-md gap-0 overflow-hidden p-0"
      >
        <div className="px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">{t("aiConsentPrompt.title")}</h2>
          </DialogTitle>
        </div>

        <div className="px-6 py-6 flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
            <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-3">
            <DialogDescription asChild>
              <p className="text-sm text-foreground leading-relaxed">{t("aiConsentPrompt.body")}</p>
            </DialogDescription>
            <p className="text-sm text-foreground leading-relaxed">{t("aiConsentPrompt.ifOff")}</p>
            <p className="text-[13px] text-muted-foreground">
              {t("aiConsentPrompt.change")}{" "}
              <Link href="/homepage/term" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                {t("aiConsentPrompt.readTerms")}
              </Link>
            </p>
            {setConsent.isError && (
              <p className="text-[13px] text-red-600 dark:text-red-400" role="alert">
                {t("yourData.aiProcessing.error")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <button
            type="button"
            onClick={() => answer(false)}
            disabled={setConsent.isPending}
            className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("aiConsentPrompt.switchOff")}
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            disabled={setConsent.isPending}
            autoFocus
            className="inline-flex items-center gap-2 bg-brand-navy-900 text-white text-xs font-semibold tracking-wider uppercase px-6 py-2.5 rounded-full hover:bg-brand-navy-800 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {setConsent.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {t("aiConsentPrompt.keepOn")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
