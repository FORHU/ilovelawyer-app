import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Sparkles } from "lucide-react"
import AttributedMarkdown, { AttributedTextLegend } from "@/components/shared/attributed-text"
import { useAiJobStatus, useGenerateRedTeamMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot, RedTeamArgumentStrength, RedTeamArguments } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, SectionLabel, ghostBtnClass, labelTextClass } from "@/components/terminal/panel-kit"

const STRENGTHS: RedTeamArgumentStrength[] = ["STRONG", "MODERATE", "WEAK"]
// Colored from the user's side: an argument that's STRONG for the opponent is the danger.
const STRENGTH_STYLE: Record<RedTeamArgumentStrength, { badge: string; bar: string; text: string; label: string }> = {
  STRONG: { badge: "border-red-400/50 bg-red-400/10 text-red-400", bar: "bg-red-400", text: "text-red-400", label: "redTeamStrong" },
  MODERATE: { badge: "border-orange-400/50 bg-orange-400/10 text-orange-400", bar: "bg-orange-400", text: "text-orange-400", label: "redTeamModerate" },
  WEAK: { badge: "border-emerald-500/50 bg-emerald-500/10 text-emerald-500", bar: "bg-emerald-500", text: "text-emerald-500", label: "redTeamWeak" },
}

// Opposing counsel's own adversarial read of the case — generated from the case's structured
// findings (Legal Issues, Weaknesses, Contradictions, Witnesses, Damages), not raw documents.
// No manual edit, unlike Case Reconstruction: this is meant to be read as their commentary.
export function RedTeamPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const generate = useGenerateRedTeamMutation(caseId)
  const job = useAiJobStatus(caseId, "redTeam")
  const isGenerating = generate.isPending || job.data?.status === "IN_PROGRESS"
  const content = snapshot.redTeamAssessment?.content ?? ""
  const claims = snapshot.redTeamAssessment?.claims ?? []
  const ranked = snapshot.redTeamAssessment?.arguments ?? null

  return (
    <PanelBody gap="3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("redTeamAssessment")}</SectionLabel>
        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={isGenerating}
          className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {isGenerating
            ? t("generating")
            : content
              ? t("regenerate")
              : t("generate")}
        </button>
      </div>
      <MutationError show={generate.isError} />

      {!content && !isGenerating ? (
        <EmptyNote>{t("noRedTeam")}</EmptyNote>
      ) : content ? (
        <>
          {ranked && ranked.arguments.length > 0 ? <RankedArguments ranked={ranked} /> : null}
          {claims.length > 0 && <AttributedTextLegend />}
          <AttributedMarkdown content={content} claims={claims} />
        </>
      ) : null}
    </PanelBody>
  )
}

function RankedArguments({ ranked }: { ranked: RedTeamArguments }) {
  const { t } = useTranslation("terminal")
  const [open, setOpen] = useState<number | null>(null)
  const counts = { STRONG: 0, MODERATE: 0, WEAK: 0 }
  ranked.arguments.forEach((a) => {
    counts[a.strength] += 1
  })
  // Some rows Jev-checked and this one not means its call failed — say so rather than let the
  // row pass as verified.
  const anyJev = ranked.arguments.some((a) => a.jev)
  const risk = ranked.riskOfLoss
  const riskStroke =
    risk === null ? "" : risk >= 67 ? "stroke-red-400" : risk >= 34 ? "stroke-orange-400" : "stroke-emerald-500"
  const ringR = 15
  const ringC = 2 * Math.PI * ringR

  return (
    <div className="flex shrink-0 flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        {ranked.opponent
          ? t("redTeamArgumentsIntro", { opponent: ranked.opponent })
          : t("redTeamArgumentsIntroNoParty")}
      </p>
      <div className="flex items-center gap-3">
        {risk !== null ? (
          <div className="relative h-10 w-10 shrink-0" title={t("redTeamRiskOfLoss")}>
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r={ringR} fill="none" strokeWidth="3" className="stroke-border" />
              <circle
                cx="18"
                cy="18"
                r={ringR}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                className={riskStroke}
                strokeDasharray={`${(risk / 100) * ringC} ${ringC}`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
              {risk}%
            </span>
            <span className="sr-only">{t("redTeamRiskOfLoss")}</span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex h-1.5 gap-px overflow-hidden rounded-full">
            {STRENGTHS.map((s) =>
              counts[s] ? <div key={s} className={STRENGTH_STYLE[s].bar} style={{ flexGrow: counts[s] }} /> : null,
            )}
          </div>
          <div className={`mt-1.5 flex flex-wrap gap-x-3 ${labelTextClass}`}>
            {STRENGTHS.map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-sm ${STRENGTH_STYLE[s].bar}`} />
                {t(STRENGTH_STYLE[s].label)} <span className={STRENGTH_STYLE[s].text}>{counts[s]}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <PanelRowList>
        {ranked.arguments.map((a, i) => {
          const style = STRENGTH_STYLE[a.strength]
          const hurts = a.impact > 0
          const isOpen = open === i
          const jev = a.jev ?? null
          const flagged = jev !== null && jev.support !== "SUPPORTED"
          return (
            <PanelRow key={`${i}-${a.title}`} className="flex-col items-stretch gap-2">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                    {a.title}
                    {flagged ? (
                      <span
                        className="rounded border border-amber-500/50 px-1 text-[9px] font-semibold uppercase tracking-[1px] text-amber-500"
                        title={t(`redTeamJevSupport.${jev.support}`)}
                      >
                        {t("redTeamJevFlag")}
                      </span>
                    ) : null}
                  </span>
                  {a.gist ? <span className={`mt-0.5 block ${labelTextClass}`}>{a.gist}</span> : null}
                </span>
                <span
                  className={`shrink-0 text-[11px] font-semibold tabular-nums ${
                    hurts ? "text-red-400" : a.impact < 0 ? "text-emerald-500" : "text-muted-foreground"
                  }`}
                  title={t("redTeamImpact")}
                >
                  {hurts ? `▲ +${a.impact}` : a.impact < 0 ? `▼ ${a.impact}` : "0"}
                  {jev?.uncertain ? <span title={t("redTeamJevUncertain")}>{" ~"}</span> : null}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px] ${style.badge}`}
                >
                  {t(style.label)}
                </span>
              </button>
              {isOpen ? (
                <div className="flex flex-col gap-1.5 rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
                  {a.reasoning ? <p>{a.reasoning}</p> : null}
                  {jev ? (
                    <div className="flex flex-col gap-0.5 border-t border-border pt-1.5 text-muted-foreground">
                      <p>
                        <span className="text-foreground">{t("redTeamJevCheckedBy")}</span>{" "}
                        {t(`redTeamJevSupport.${jev.support}`)} ({Math.round(jev.supportConfidence * 100)}%)
                      </p>
                      <p>
                        {t("redTeamJevLikelihood", { pct: Math.round(jev.likelihood * 100), conf: Math.round(jev.likelihoodConfidence * 100) })}
                        {" · "}
                        {t("redTeamJevSeverity", { pct: Math.round(jev.severity * 100), conf: Math.round(jev.severityConfidence * 100) })}
                      </p>
                      {jev.uncertain ? <p className="text-amber-500">{t("redTeamJevUncertain")}</p> : null}
                      {a.modelStrength ? (
                        <p>
                          {t("redTeamJevModelRating", {
                            strength: t(STRENGTH_STYLE[a.modelStrength].label),
                            impact: a.modelImpact !== undefined && a.modelImpact > 0 ? `+${a.modelImpact}` : String(a.modelImpact ?? 0),
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : anyJev ? (
                    <p className="text-amber-500">{t("redTeamJevNotChecked")}</p>
                  ) : null}
                  <p className="text-muted-foreground">
                    {t("redTeamRestsOn", { kind: t(`redTeamSource.${a.source.kind}`) })}{" "}
                    <span className="text-foreground">“{a.source.label}”</span>
                  </p>
                </div>
              ) : null}
            </PanelRow>
          )
        })}
      </PanelRowList>
    </div>
  )
}
