import { useTranslation } from "react-i18next"
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react"
import type { AudioOverviewTurn, AudioOverviewTurnCheck } from "@/lib/chat/mutations"

const VERDICT_STYLE = {
  SUPPORTED: { Icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400", key: "supported" },
  UNSUPPORTED: { Icon: CircleHelp, className: "text-amber-600 dark:text-amber-400", key: "unsupported" },
  CONTRADICTED: { Icon: XCircle, className: "text-red-600 dark:text-red-400", key: "contradicted" },
} as const

/** Jev's verdict on one script turn — an icon with the reading as its tooltip, so it stays out of
 * the way of the text being read (ilovelawyer-api's audio-overview-jev.ts). */
function TurnCheckIcon({ check }: { check: AudioOverviewTurnCheck }) {
  const { t } = useTranslation("case-portfolio")
  const { Icon, className, key } = VERDICT_STYLE[check.verdict]
  const label = t(`audioOverviewCheck.${key}`)
  return <Icon className={`h-3.5 w-3.5 shrink-0 ${className}`} aria-label={label} role="img" />
}

/** The script as a list of host turns, each with Jev's verdict when there is one. `checks` is
 * empty/absent when the check is off or hasn't finished — turns then render bare. */
export function AudioOverviewTurns({
  turns,
  checks,
}: {
  turns: AudioOverviewTurn[]
  checks?: AudioOverviewTurnCheck[] | null
}) {
  const { t } = useTranslation("case-portfolio")
  const byTurn = new Map((checks ?? []).map((c) => [c.turn, c]))
  return (
    <div className="space-y-3">
      {turns.map((turn, i) => {
        const check = byTurn.get(i)
        return (
          <div key={i}>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-gold">
              {turn.speaker === "HOST_A" ? t("workspace.audioOverviewHostA") : t("workspace.audioOverviewHostB")}
              {check && <TurnCheckIcon check={check} />}
            </p>
            <p className="text-[13px] leading-5 text-foreground">{turn.text}</p>
          </div>
        )
      })}
    </div>
  )
}
