import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Loader2 } from "lucide-react"
import { useAudioOverviewHistoryQuery, type AudioOverviewHistoryEntry } from "@/lib/terminal/mutations"
import { AudioOverviewTurns } from "@/components/audio-overview/audio-overview-turns"

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

/** Every Audio Overview generated for the case, newest first — the counterpart of the Case
 * Brief's history tab, loaded by scrolling (see CaseBriefHistory for why an observer rooted on
 * the scroll container rather than a Load More button). Each entry plays back its rendered audio
 * and expands to its script with Jev's verdicts. */
export function AudioOverviewHistory({ caseId }: { caseId: string }) {
  const { t } = useTranslation("case-portfolio")
  const history = useAudioOverviewHistoryQuery(caseId)
  const sentinelRef = useRef<HTMLLIElement>(null)
  const scrollContainerRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollContainerRef.current
    if (!sentinel || !root || !history.hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !history.isFetchingNextPage) history.fetchNextPage()
      },
      { root, rootMargin: "100px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.hasNextPage, history.isFetchingNextPage, history.data])

  if (history.isPending) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("workspace.audioOverviewHistoryLoading")}
      </div>
    )
  }
  if (history.isError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {t("workspace.audioOverviewHistoryError")}
      </div>
    )
  }
  const entries = history.data.pages.flatMap((page) => page.items)
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        {t("workspace.audioOverviewHistoryEmpty")}
      </div>
    )
  }

  return (
    <ul ref={scrollContainerRef} className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
      {entries.map((entry) => (
        <HistoryEntry key={entry.id} entry={entry} />
      ))}
      {history.hasNextPage && (
        <li ref={sentinelRef} className="flex shrink-0 items-center justify-center py-2" aria-hidden="true">
          {history.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </li>
      )}
    </ul>
  )
}

function HistoryEntry({ entry }: { entry: AudioOverviewHistoryEntry }) {
  const { t } = useTranslation("case-portfolio")
  const [open, setOpen] = useState(false)
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{formatEntryDate(entry.createdAt)}</p>
        <p className="text-xs text-muted-foreground">
          {t("workspace.audioOverviewHistoryTurns", { count: entry.turns.length })}
        </p>
      </div>
      {entry.audio ? (
        <audio controls preload="none" src={entry.audio.fileUrl} className="h-9 w-full" />
      ) : (
        <p className="text-xs text-muted-foreground">
          {entry.status === "FAILED"
            ? t("workspace.audioOverviewRenderError")
            : entry.status === "IN_PROGRESS"
              ? t("workspace.audioOverviewRendering")
              : t("workspace.audioOverviewHistoryNoAudio")}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-gold"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        {open ? t("workspace.audioOverviewHistoryHideScript") : t("workspace.audioOverviewHistoryShowScript")}
      </button>
      {open && <AudioOverviewTurns turns={entry.turns} checks={entry.checks} />}
    </li>
  )
}
