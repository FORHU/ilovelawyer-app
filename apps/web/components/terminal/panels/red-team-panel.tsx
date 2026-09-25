import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Sparkles } from "lucide-react"
import AttributedMarkdown, { AttributedTextLegend } from "@/components/shared/attributed-text"
import { useAiJobStatus, useGenerateRedTeamMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot, RedTeamArgumentStrength, RedTeamArguments } from "@/lib/terminal/types"
import {
  DeltaMark,
  EmptyNote,
  JevCheck,
  JevFlag,
  JevNotChecked,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  SectionLabel,
  TagMixSummary,
  TonePill,
  ghostBtnClass,
  labelTextClass,
  type Tone,
} from "@/components/terminal/panel-kit"

const STRENGTHS: RedTeamArgumentStrength[] = ["STRONG", "MODERATE", "WEAK"]
// Colored from the user's side: an argument that's STRONG for the opponent is the danger.
const STRENGTH_STYLE: Record<RedTeamArgumentStrength, { tone: Tone; label: string }> = {
  STRONG: { tone: "danger", label: "redTeamStrong" },
  MODERATE: { tone: "riskmed", label: "redTeamModerate" },
  WEAK: { tone: "ok", label: "redTeamWeak" },
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

  return (
    <div className="flex shrink-0 flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        {ranked.opponent
          ? t("redTeamArgumentsIntro", { opponent: ranked.opponent })
          : t("redTeamArgumentsIntroNoParty")}
      </p>
      <TagMixSummary
        ring={
          risk !== null
            ? { pct: risk, tone: risk >= 67 ? "danger" : risk >= 34 ? "riskmed" : "ok", title: t("redTeamRiskOfLoss") }
            : undefined
        }
        segments={STRENGTHS.map((s) => ({ key: s, label: t(STRENGTH_STYLE[s].label), count: counts[s], tone: STRENGTH_STYLE[s].tone }))}
      />
      <PanelRowList>
        {ranked.arguments.map((a, i) => {
          const style = STRENGTH_STYLE[a.strength]
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
                    {flagged ? <JevFlag title={t(`redTeamJevSupport.${jev.support}`)} /> : null}
                  </span>
                  {a.gist ? <span className={`mt-0.5 block ${labelTextClass}`}>{a.gist}</span> : null}
                </span>
                <DeltaMark value={a.impact} badWhenUp title={t("redTeamImpact")}>
                  {jev?.uncertain ? <span title={t("jevUncertain")}>{" ~"}</span> : null}
                </DeltaMark>
                <TonePill tone={style.tone}>{t(style.label)}</TonePill>
              </button>
              {isOpen ? (
                <div className="flex flex-col gap-1.5 rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
                  {a.reasoning ? <p>{a.reasoning}</p> : null}
                  {jev ? (
                    <JevCheck
                      verdict={t(`redTeamJevSupport.${jev.support}`)}
                      confidence={jev.supportConfidence}
                      uncertain={jev.uncertain}
                      modelRating={
                        a.modelStrength
                          ? t("redTeamJevModelRating", {
                              strength: t(STRENGTH_STYLE[a.modelStrength].label),
                              impact: a.modelImpact !== undefined && a.modelImpact > 0 ? `+${a.modelImpact}` : String(a.modelImpact ?? 0),
                            })
                          : null
                      }
                    >
                      <p>
                        {t("redTeamJevLikelihood", { pct: Math.round(jev.likelihood * 100), conf: Math.round(jev.likelihoodConfidence * 100) })}
                        {" · "}
                        {t("redTeamJevSeverity", { pct: Math.round(jev.severity * 100), conf: Math.round(jev.severityConfidence * 100) })}
                      </p>
                    </JevCheck>
                  ) : anyJev ? (
                    <JevNotChecked />
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
