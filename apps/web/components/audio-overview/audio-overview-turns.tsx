import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react"
import type { AudioOverviewTurn, AudioOverviewTurnCheck } from "@/lib/chat/mutations"
import { formatClock, hasUsableTimings } from "@/components/audio-overview/audio-overview-sync"

const VERDICT_STYLE = {
  SUPPORTED: { Icon: CheckCircle2, className: "text-ok", key: "supported" },
  UNSUPPORTED: { Icon: CircleHelp, className: "text-warn", key: "unsupported" },
  CONTRADICTED: { Icon: XCircle, className: "text-danger", key: "contradicted" },
} as const

/** Jev's verdict on one script turn — an icon with the reading as its tooltip, so it stays out of
 * the way of the text being read (ilovelawyer-api's audio-overview-jev.ts). */
export function TurnCheckIcon({ check, size = "h-3 w-3" }: { check: AudioOverviewTurnCheck; size?: string }) {
  const { t } = useTranslation("case-portfolio")
  const { Icon, className, key } = VERDICT_STYLE[check.verdict]
  const label = t(`audioOverviewCheck.${key}`)
  return (
    <span title={label} className="inline-flex">
      <Icon className={`${size} shrink-0 ${className}`} aria-label={label} role="img" strokeWidth={2.2} />
    </span>
  )
}

export function hostLabel(t: TFunction, speaker: AudioOverviewTurn["speaker"]): string {
  return speaker === "HOST_A" ? t("workspace.audioOverviewHostA") : t("workspace.audioOverviewHostB")
}

/** The script as a static list — timecode, host, Jev's verdict, text — for History's expanded
 * rows. The Current view's live, playback-synced transcript is AudioOverviewTranscript. */
export function AudioOverviewTurns({
  turns,
  checks,
  turnTimings,
}: {
  turns: AudioOverviewTurn[]
  checks?: AudioOverviewTurnCheck[] | null
  turnTimings?: number[] | null
}) {
  const { t } = useTranslation("case-portfolio")
  const byTurn = new Map((checks ?? []).map((c) => [c.turn, c]))
  const timed = hasUsableTimings(turnTimings, turns.length)

  return (
    <div className="flex flex-col gap-2">
      {turns.map((turn, i) => {
        const check = byTurn.get(i)
        return (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              {timed && <span className="font-mono text-[9.5px] text-muted-foreground/70">{formatClock(turnTimings[i]!)}</span>}
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-gold">{hostLabel(t, turn.speaker)}</span>
              {check && <TurnCheckIcon check={check} size="h-2.75 w-2.75" />}
            </div>
            <p className="text-xs leading-4.5 text-muted-foreground">{turn.text}</p>
          </div>
        )
      })}
    </div>
  )
}
