"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowUpRight, Compass, FileText, RotateCcw, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { useTourStore, type GuideMessage } from "@/lib/store/tour.store"
import {
  CONSULTATION_PATH,
  GUIDE_SUGGESTIONS,
  GUIDE_SUGGESTIONS_BY_ROUTE,
  matchGuideAnswer,
  routeMatches,
} from "@/lib/tour/steps"
import { pageGuideFor } from "@/lib/tour/page-tours"
import { sampleCaseHref } from "@/lib/sample-case/tours"
import { useTourT } from "@/lib/tour/use-tour-t"

/** Renders `**bold**` spans in a canned answer; everything else is plain text. */
function AnswerText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*)/)
        .filter(Boolean)
        .map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.replace(/\*+$/, ""),
        )}
    </>
  )
}

const pill =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 self-start rounded-full border px-3.5 text-[10px] font-semibold uppercase tracking-[1px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
const iconButton =
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** "Ask the guide": the tour of the page the user is on, any time (see pageGuideFor), and answers
 * to how-to questions from a written list (see GUIDE_ANSWERS) that light up the control they
 * describe. Legal questions are pointed at Consultation instead, where answers carry citations. */
export function GuideDrawer({ phone }: { phone: boolean }) {
  const { t } = useTourT()
  const pathname = usePathname()
  const router = useRouter()
  const messages = useTourStore((s) => s.messages)
  const ask = useTourStore((s) => s.ask)
  const clearGuide = useTourStore((s) => s.clearGuide)
  const setGuideOpen = useTourStore((s) => s.setGuideOpen)
  const setGuideSpot = useTourStore((s) => s.setGuideSpot)
  const setGuideMinimized = useTourStore((s) => s.setGuideMinimized)
  const setPageTour = useTourStore((s) => s.setPageTour)
  const setSampleTourRequested = useTourStore((s) => s.setSampleTourRequested)
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const close = () => {
    setGuideOpen(false)
    setGuideMinimized(false)
  }

  /** Closes the drawer and spotlights the control, going to its page first if needed. The
   * minimized pill brings the conversation back. */
  const show = (highlight: NonNullable<GuideMessage["highlight"]>) => {
    if (highlight.route && !routeMatches(highlight.route, pathname)) router.push(highlight.route)
    setGuideOpen(false)
    setGuideSpot(highlight)
    setGuideMinimized(true)
  }

  const askQuestion = (question: string) => {
    const q = question.trim()
    if (!q) return
    setDraft("")
    const match = matchGuideAnswer(q)
    if (match.kind === "answer") {
      const { answer } = match
      const text = t(`answers.${answer.id}`)
      const label = t(`targets.${answer.target}`)
      ask(q, {
        text,
        topic: t(`helpTopics.${answer.topic}`),
        highlight: { target: answer.target, route: answer.route, label, title: label, body: text.replace(/\*\*/g, "") },
      })
      return
    }
    ask(q, { text: match.kind === "legal" ? t("guide.legalAnswer") : t("guide.fallbackAnswer"), handoff: match.kind === "legal" })
  }

  const pageGuide = pageGuideFor(pathname)
  const pageTourLabel =
    pageGuide?.kind === "sample"
      ? t(pageGuide.track === "studio" ? "guide.tourWorkspace" : "guide.tourTerminal")
      : t("guide.tourThisPage")

  // Every tour starts with the drawer out of the way — its own dialogs and the spotlight only
  // show once it's closed.
  const startPageTour = () => {
    if (!pageGuide) return
    close()
    if (pageGuide.kind === "page") setPageTour("manual")
    else if (pageGuide.kind === "sample-here") setSampleTourRequested(true)
    else {
      // Read at click time, not through useSearchParams: this drawer is mounted on every page,
      // outside any Suspense boundary, and only needs the query string for this one link.
      router.push(sampleCaseHref(pageGuide.track, pathname + window.location.search))
    }
  }

  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.text))
  const suggestionKeys = [...new Set([...(GUIDE_SUGGESTIONS_BY_ROUTE[pathname] ?? []), ...GUIDE_SUGGESTIONS])]
  const suggestions = suggestionKeys.map((k) => t(`suggestions.${k}`))
  const last = messages.at(-1)
  const busy = !!last && last.role === "guide" && !last.done
  const showMore = !!last && last.role === "guide" && last.done

  return (
    <>
      {phone && <div aria-hidden="true" onClick={close} className="fixed inset-0 z-[9049] bg-black/40" />}
      <aside
        role="dialog"
        aria-label={t("guide.title")}
        className={`fixed bottom-0 right-0 z-[9050] flex flex-col border-l border-border bg-background text-foreground shadow-2xl animate-in slide-in-from-right duration-300 ${
          phone ? "top-0 w-full" : "top-16 w-[400px]"
        }`}
      >
        <div className="flex items-start gap-2.5 border-b border-border px-5 pt-4.5 pb-3.5">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("guide.eyebrow")}</span>
            <span className="font-['Libre_Caslon_Text'] text-2xl font-light tracking-[-0.01em]">{t("guide.title")}</span>
          </div>
          {messages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={clearGuide} aria-label={t("guide.startOver")} className={iconButton}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("guide.startOver")}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={close} aria-label={t("guide.close")} className={iconButton}>
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("guide.close")}</TooltipContent>
          </Tooltip>
        </div>

        {pageGuide && (
          <div className="flex flex-col gap-2 border-b border-border px-5 py-3.5">
            <span className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("guide.tours")}</span>
            <button type="button" onClick={startPageTour} className={`${pill} h-auto min-h-8 py-1.5 text-left border-foreground`}>
              <Compass className="size-3" aria-hidden="true" />
              {pageTourLabel}
            </button>
          </div>
        )}

        <div ref={scrollRef} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overflow-x-hidden px-5 py-4.5">
          {messages.length === 0 && (
            <>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{t("guide.intro")}</p>
              <div className="flex flex-col gap-1.5">
                {suggestions.slice(0, 6).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => askQuestion(q)}
                    className="cursor-pointer rounded-[14px] border border-border px-3.5 py-2.5 text-left text-[12.5px] transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="max-w-[88%] self-end rounded-2xl bg-foreground/[0.06] px-3.5 py-2.5 text-[13px] leading-normal">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-2 animate-in fade-in-0 duration-200">
                <span className="text-[13px] leading-relaxed text-pretty">
                  <AnswerText text={m.text.slice(0, m.shown)} />
                  {!m.done && (
                    <span aria-hidden="true" className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse bg-foreground align-[-2px]" />
                  )}
                </span>
                {m.done && m.highlight && (
                  <button type="button" onClick={() => show(m.highlight!)} className={`${pill} h-7 border-foreground`}>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />
                    {t("guide.showing", { label: m.highlight.label })}
                  </button>
                )}
                {m.done && m.topic && (
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <FileText className="size-3" aria-hidden="true" />
                    {t("guide.helpDoc", { topic: m.topic })}
                  </span>
                )}
                {m.done && m.handoff && (
                  <button
                    type="button"
                    onClick={() => {
                      close()
                      router.push(CONSULTATION_PATH)
                    }}
                    className={`${pill} border-border hover:border-foreground`}
                  >
                    {t("guide.openConsultation")}
                  </button>
                )}
              </div>
            ),
          )}

          {showMore && (
            <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3 animate-in fade-in-0 duration-200">
              <span className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("guide.askSomethingElse")}</span>
              {suggestions
                .filter((q) => !asked.has(q))
                .slice(0, 4)
                .map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => askQuestion(q)}
                    className="cursor-pointer rounded-[14px] border border-border px-3.5 py-2.5 text-left text-[12.5px] transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {q}
                  </button>
                ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy) askQuestion(draft)
          }}
          className="border-t border-border px-4 pt-3 pb-4"
        >
          <div className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-4 pr-1.5">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("guide.placeholder")}
              aria-label={t("guide.title")}
              autoFocus
              className="h-8 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-[13px]"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  aria-label={t("guide.send")}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-foreground/30 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("guide.send")}</TooltipContent>
            </Tooltip>
          </div>
        </form>
      </aside>
    </>
  )
}
