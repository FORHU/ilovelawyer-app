import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CalendarClock, CircleAlert, CircleCheck, Gavel, Scale, Sparkles } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { DamageClaim, DamagesSummary } from "@/lib/terminal/types"
import { deadlineStats, formatMoney, formatMoneyCompact } from "@/lib/terminal/damages-format"
import { PanelStickyHeader, labelTextClass } from "@/components/terminal/panel-kit"
import { dateLocale } from "@/lib/i18n/date-locale"

/**
 * The head of the Damages & Remedies pane: the total claimed, how much of it is awarded or
 * received against what is still open (one meter, status colours from the shared ok/warn tokens,
 * each segment named in the legend beside it), how many AI suggestions wait for review, and four
 * tiles — damages and remedies in their category colours, overdue and next deadline in status
 * colours. Every tile keeps its colour at zero, so an empty case still reads at a glance; every
 * figure is labelled, so colour is never the only cue.
 */
export function DamagesOverview({
  summary,
  heads,
  displayTotal,
  dimmed,
}: {
  summary: DamagesSummary
  heads: DamageClaim[]
  /** The total as it counts up after a change (the pane animates it). */
  displayTotal: number
  dimmed?: boolean
}) {
  const { t } = useTranslation("terminal")
  const money = (value: number) => formatMoney(value, summary.currency)
  const open = Math.max(0, Math.round((summary.total - summary.awarded) * 100) / 100)
  const awardedShare = summary.total > 0 ? summary.awarded / summary.total : 0
  const pct = (share: number) => Math.round(share * 100)
  const { overdue, next } = deadlineStats(heads)
  const suggestedCount = summary.suggestedCount ?? 0
  const suggestedTotal = summary.suggestedTotal ?? 0
  const nextDate = next ? new Date(next.dueDate).toLocaleDateString(dateLocale(), { timeZone: "UTC", month: "short", day: "numeric" }) : null

  return (
    <>
      {/* The total and its awarded/open meter stay pinned while the entries scroll; the tiles
          scroll away with them. Fades the content, not the sticky box, so rows never show through. */}
      <PanelStickyHeader>
        <div className={cn("flex flex-col gap-3 transition-opacity", dimmed && "opacity-60")}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <div className="flex flex-col gap-1">
            <p className={labelTextClass}>{t("damagesTotalClaim")}</p>
            <p
              className="font-['Libre_Caslon_Text'] text-[30px] leading-none font-normal tracking-[-0.02em] text-foreground tabular-nums"
              title={money(summary.total)}
            >
              {formatMoneyCompact(displayTotal, summary.currency)}
            </p>
          </div>
          {summary.total > 0 ? (
            <p className="text-[12px] text-muted-foreground tabular-nums">
              <span className="font-semibold text-ok">{t("damagesAwardedShare", { pct: pct(awardedShare) })}</span>{" "}
              {t("damagesAwardedShareOf", { total: money(summary.total) })}
            </p>
          ) : null}
        </div>

        {/* AI suggestions are left out of the total until accepted; this says they are there, and
            what they would add, so a total of zero beside a list of entries isn't a puzzle. */}
        {suggestedCount > 0 ? (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground tabular-nums">
            <Sparkles className="size-3.5 text-warn" aria-hidden="true" />
            <span className="font-semibold text-foreground">{t("damagesSuggestedWaiting", { count: suggestedCount })}</span>
            {suggestedTotal > 0 ? <span>· {t("damagesSuggestedAmount", { total: money(suggestedTotal) })}</span> : null}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
            {/* Awarded | still open, end to end with a 2px gap. The track is the open colour's own
                tint, so the bar reads as one whole. */}
            <div
              className={cn("flex h-2 w-full gap-[2px] overflow-hidden rounded-full", summary.total > 0 ? "bg-warn/15" : "bg-muted")}
              role="img"
              aria-label={t("damagesMeterLabel", { awarded: money(summary.awarded), open: money(open) })}
            >
              {summary.awarded > 0 ? (
                <div
                  className="h-full rounded-full bg-ok"
                  style={{ width: `${awardedShare * 100}%` }}
                  title={`${t("damagesLegendAwarded")}: ${money(summary.awarded)} (${pct(awardedShare)}%)`}
                />
              ) : null}
              {open > 0 ? (
                <div
                  className="h-full flex-1 rounded-full bg-warn"
                  title={`${t("damagesLegendOpen")}: ${money(open)} (${100 - pct(awardedShare)}%)`}
                />
              ) : null}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
              <LegendItem dotClass="bg-ok" label={t("damagesLegendAwarded")} value={money(summary.awarded)} />
              <LegendItem dotClass="bg-warn" label={t("damagesLegendOpen")} value={money(open)} />
            </ul>
          </div>
        </div>
      </PanelStickyHeader>

      <div className={cn("grid shrink-0 grid-cols-1 gap-2 transition-opacity @3xs:grid-cols-2 @lg:grid-cols-4", dimmed && "opacity-60")}>
        <Tile icon={<Scale className="size-3.5" aria-hidden="true" />} label={t("damagesTileDamages")} value={summary.damageCount} tone="damage" />
        <Tile icon={<Gavel className="size-3.5" aria-hidden="true" />} label={t("damagesTileRemedies")} value={summary.remedyCount} tone="remedy" />
        <Tile
          icon={
            overdue > 0 ? <CircleAlert className="size-3.5" aria-hidden="true" /> : <CircleCheck className="size-3.5" aria-hidden="true" />
          }
          label={t("damagesTileOverdue")}
          value={overdue}
          tone={overdue > 0 ? "danger" : "ok"}
          foot={overdue > 0 ? t("damagesOverdueFoot") : t("damagesNothingOverdue")}
        />
        <Tile
          icon={<CalendarClock className="size-3.5" aria-hidden="true" />}
          label={t("damagesTileNextDeadline")}
          value={nextDate ?? "—"}
          // Amber when one is close, or when none is set yet (nothing is tracking the entries).
          tone={!next || next.days <= 7 ? "warn" : "ok"}
          foot={next ? (next.days === 0 ? t("damagesDueToday") : t("damagesDueIn", { count: next.days })) : t("damagesNoDeadline")}
        />
      </div>
    </>
  )
}

function LegendItem({ dotClass, label, value }: { dotClass: string; label: string; value: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground tabular-nums">{value}</span>
    </li>
  )
}

type TileTone = "damage" | "remedy" | "ok" | "warn" | "danger"

// Category colours for the two kinds, status colours for the rest — all theme tokens.
const TILE_TONE: Record<TileTone, { text: string; frame: string }> = {
  damage: { text: "text-kind-damage", frame: "border-kind-damage/40 bg-kind-damage/[0.07]" },
  remedy: { text: "text-kind-remedy", frame: "border-kind-remedy/40 bg-kind-remedy/[0.07]" },
  ok: { text: "text-ok", frame: "border-ok/40 bg-ok/[0.07]" },
  warn: { text: "text-warn", frame: "border-warn/40 bg-warn/[0.07]" },
  danger: { text: "text-danger", frame: "border-danger/50 bg-danger/10" },
}

// One figure with its label. The tone tints the frame, the icon and the foot line — the number
// stays in the text colour, and the label always says what the colour means.
function Tile({
  icon,
  label,
  value,
  tone,
  foot,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  tone: TileTone
  foot?: string
}) {
  const style = TILE_TONE[tone]
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 rounded-xl border p-2.5", style.frame)}>
      <p className={cn("inline-flex items-center gap-1.5", labelTextClass)}>
        <span className={style.text}>{icon}</span>
        {label}
      </p>
      <p className="truncate text-xl leading-none font-semibold text-foreground tabular-nums">{value}</p>
      {foot ? <p className={cn("truncate text-[11px]", style.text)}>{foot}</p> : null}
    </div>
  )
}
