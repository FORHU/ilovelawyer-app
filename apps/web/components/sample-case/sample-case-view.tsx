"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { sampleCaseFor } from "@/lib/sample-case/data"
import { safeReturnPath, type SampleTile, type SampleTourTrack, type SampleView } from "@/lib/sample-case/tours"
import { SampleWorkspace } from "@/components/sample-case/sample-workspace"
import { SampleTerminal } from "@/components/sample-case/sample-terminal"
import { SampleTour } from "@/components/sample-case/sample-tour"
import { SeverityChip } from "@/components/sample-case/severity-chip"
import { useTourStore } from "@/lib/store/tour.store"
import { useTourT } from "@/lib/tour/use-tour-t"

/** The built-in sample case, read-only: its Workspace and Legal Terminal filled in, and the tour
 * for whichever one `?tour=` names. Opened on the first visit to a real case (see
 * SampleTourAutoStart) or from Ask the guide, which pass `?from=`: when the tour ends — finished or skipped — the user goes straight back
 * there. */
export function SampleCaseView() {
  const { t, tenantCode } = useTourT()
  // The user's own jurisdiction: PH users see a PH case, UK users a UK one.
  const data = sampleCaseFor(tenantCode)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [view, setView] = useState<SampleView>(params.get("view") === "terminal" ? "terminal" : "workspace")
  const [openTile, setOpenTile] = useState<SampleTile | null>(null)
  const requested = params.get("tour")
  const [tour, setTour] = useState<SampleTourTrack | null>(requested === "studio" || requested === "terminal" ? requested : null)
  const returnPath = safeReturnPath(params.get("from"))
  const sampleTourRequested = useTourStore((s) => s.sampleTourRequested)
  const setSampleTourRequested = useTourStore((s) => s.setSampleTourRequested)

  // The tour running: the one ?tour= opened the page with, or — from "Tour this page" in Ask the
  // guide — the one for whichever tab is showing.
  const activeTour: SampleTourTrack | null = tour ?? (sampleTourRequested ? (view === "terminal" ? "terminal" : "studio") : null)

  const readOnly = () => toast(t("sampleCase.readOnly"))

  const switchView = (next: SampleView) => {
    setView(next)
    const q = new URLSearchParams(params.toString())
    q.set("view", next)
    q.delete("tour")
    router.replace(`${pathname}?${q}`, { scroll: false })
  }

  const endTour = () => {
    setTour(null)
    setSampleTourRequested(false)
    if (returnPath) {
      router.replace(returnPath)
      return
    }
    // Opened directly: stay on the sample case, minus ?tour= so a refresh doesn't replay it.
    const q = new URLSearchParams(params.toString())
    q.delete("tour")
    q.set("view", view)
    router.replace(`${pathname}?${q}`, { scroll: false })
  }

  const label = "text-[10px] uppercase tracking-[1px]"

  return (
    <div className="flex w-full flex-col pt-16">
      <section className="border-b border-border px-6 md:px-16">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 pt-5">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className={`${label} inline-flex h-6 items-center gap-1.5 self-start rounded-full bg-foreground/[0.06] px-2.5 font-semibold`}>
                <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-gold" />
                {t("sampleCase.badge")}
              </span>
              <h1 className="m-0 font-['Libre_Caslon_Text'] text-[clamp(22px,3vw,30px)] font-light leading-tight tracking-[-0.02em] text-balance">
                {data.title}
              </h1>
              <span className="text-[12.5px] text-muted-foreground">
                <span className="font-mono">{data.number}</span> · {data.court} · {data.type}
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span data-sample-tour="nextdate" className="inline-flex h-7 items-center rounded-full border border-border px-3 text-[11.5px]">
                {t("sampleCase.next", { date: data.nextDate, label: data.nextDateLabel })}
              </span>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-3 text-[11.5px]">
                {t("sampleCase.risk")} <SeverityChip sev={data.risk.sev}>{data.risk.label}</SeverityChip>
              </span>
            </div>
          </div>
          <div role="tablist" aria-label={data.title} className="flex gap-6 overflow-x-auto">
            {(["workspace", "terminal"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => switchView(v)}
                className={`relative cursor-pointer whitespace-nowrap pb-3 pt-2.5 ${label} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  view === v ? "font-bold after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground" : "opacity-60 hover:opacity-100"
                }`}
              >
                {v === "workspace" ? t("sampleCase.tabWorkspace") : t("sampleCase.tabTerminal")}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="px-6 md:px-16">
        <div className="mx-auto w-full max-w-[1440px] pb-12 pt-4.5">
          {view === "workspace" ? (
            <SampleWorkspace data={data} openTile={openTile} onOpenTile={setOpenTile} onReadOnly={readOnly} />
          ) : (
            <SampleTerminal data={data} onReadOnly={readOnly} />
          )}
        </div>
      </div>

      {activeTour && <SampleTour key={activeTour} track={activeTour} view={view} onView={setView} onTile={setOpenTile} onEnd={endTour} />}
    </div>
  )
}
