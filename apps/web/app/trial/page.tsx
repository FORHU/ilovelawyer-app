"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Clock, Loader2, Lock, MessagesSquare, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { LandingNavbar } from "@/components/landing/navbar"
import { useTenantCodeHint } from "@/components/tenant-code-provider"
import { useStartTrialMutation } from "@/lib/auth/mutations"
import { useTrialConfig } from "@/lib/trial"

// Where the landing page's "Start a consultation" goes for a visitor with no account: the notice
// they accept, then a throwaway guest account and the real consultation page. UK only; any other
// host carries on to the normal sign-in.
export default function TrialPage() {
  const { t } = useTranslation("landing")
  const router = useRouter()
  const tenantCode = useTenantCodeHint()
  const start = useStartTrialMutation()
  const config = useTrialConfig()

  useEffect(() => {
    if (tenantCode !== "UK") router.replace("/login?next=%2Fhomepage")
  }, [tenantCode, router])

  if (tenantCode !== "UK") return null

  const included = [
    { icon: MessagesSquare, title: config ? t("trial.answersTitle", { count: config.messageLimit }) : t("trial.answersTitleLoading"), body: t("trial.answersBody") },
    { icon: Clock, title: config ? t("trial.timeTitle", { count: config.durationHours }) : t("trial.timeTitleLoading"), body: t("trial.timeBody") },
    { icon: Lock, title: t("trial.scopeTitle"), body: t("trial.scopeBody") },
  ]

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background text-foreground">
      <LandingNavbar overHero={false} sectionLinks={false} />
      <main className="flex flex-1 px-6 pb-16 pt-24 md:px-16">
        <div className="mx-auto my-auto grid w-full max-w-[1100px] grid-cols-1 items-start gap-10 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div className="flex flex-col items-start gap-6">
            <h1 className="m-0 max-w-[16ch] font-['Libre_Caslon_Text'] text-[clamp(34px,5vw,56px)] font-light leading-[1.04] tracking-[-0.02em] text-balance">
              {t("trial.heading")}
            </h1>
            <p className="m-0 max-w-[52ch] text-base leading-relaxed text-muted-foreground">{t("trial.body")}</p>

            <div className="flex w-full max-w-[52ch] items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-gold" aria-hidden="true" />
              <p className="m-0 text-[13.5px] leading-relaxed text-foreground">{t("trial.notice")}</p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={start.isPending}
                onClick={() => start.mutate()}
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-gold px-8 text-xs font-semibold uppercase tracking-[1.2px] text-brand-gold-foreground transition-[background-color,transform] duration-200 hover:bg-brand-gold/85 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-70"
              >
                {start.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {start.isPending ? t("trial.starting") : t("trial.start")}
              </button>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-full px-6 text-xs uppercase tracking-[1.2px] text-muted-foreground underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("trial.haveAccount")}
              </Link>
            </div>

            <p role="alert" className="m-0 min-h-5 text-sm text-destructive">
              {start.isError ? t("trial.error") : ""}
            </p>
          </div>

          <section aria-labelledby="trial-included" className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <h2 id="trial-included" className="m-0 font-['Libre_Caslon_Text'] text-xl font-light tracking-[-0.01em]">
              {t("trial.includedHeading")}
            </h2>
            <ul className="m-0 mt-5 flex list-none flex-col gap-6 p-0">
              {included.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-medium leading-snug">{title}</span>
                    <span className="text-[13.5px] leading-relaxed text-muted-foreground">{body}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
