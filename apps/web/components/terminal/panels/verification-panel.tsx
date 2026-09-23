import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, FileQuestion, FileX2, ShieldCheck } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  isProblem,
  useGroundingChecksQuery,
  type GroundingCheck,
  type GroundingVerdict,
} from "@/lib/terminal/grounding"
import {
  EmptyNote,
  PanelBody,
  PanelRow,
  PanelRowList,
  SectionLabel,
  bodyTextClass,
  labelTextClass,
  secondaryTextClass,
} from "@/components/terminal/panel-kit"

/**
 * What was checked in this case's legal answers, and what failed — the read side of the API's
 * grounding verifier. Rows are written automatically per legal chat turn, so there is no
 * "Generate" action here, the same as Decisions.
 *
 * The panel leads with problems because that is the only part a lawyer must act on: an assertion
 * the cited document contradicts, or a document the answer said it could not see when it could.
 * Everything that checked out is collapsed behind a count — a wall of green ticks buries the two
 * rows that matter.
 */

const VERDICT_TONE: Record<GroundingVerdict, string> = {
  CONTRADICTED: "text-destructive",
  FALSE_ABSENCE: "text-destructive",
  UNSUPPORTED: "text-amber-600 dark:text-amber-500",
  NOT_SUPPLIED: "text-amber-600 dark:text-amber-500",
  UNRESOLVED: "text-muted-foreground",
  CORRECT_ABSENCE: "text-muted-foreground",
  SUPPORTED: "text-emerald-600 dark:text-emerald-500",
}

function VerdictIcon({ verdict }: { verdict: GroundingVerdict }) {
  const className = cn("size-3.5 shrink-0", VERDICT_TONE[verdict])
  if (verdict === "CONTRADICTED") return <AlertTriangle className={className} aria-hidden />
  if (verdict === "FALSE_ABSENCE") return <FileX2 className={className} aria-hidden />
  if (verdict === "SUPPORTED") return <ShieldCheck className={className} aria-hidden />
  return <FileQuestion className={className} aria-hidden />
}

function CheckRow({ check }: { check: GroundingCheck }) {
  const { t } = useTranslation("terminal")
  return (
    <PanelRow className="items-start">
      <VerdictIcon verdict={check.verdict} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn(labelTextClass, VERDICT_TONE[check.verdict])}>
            {t(`groundingVerdict.${check.verdict}`)}
          </span>
          {check.citation ? <span className={cn(secondaryTextClass, "font-mono text-[11px]")}>{check.citation}</span> : null}
          {/* Only shown when the model decided it — absence verdicts are settled by lookup and
              carry no confidence, and printing "100%" for those would overstate them. */}
          {check.confidence !== null ? (
            <span className={cn(secondaryTextClass, "text-[11px] tabular-nums")}>{Math.round(check.confidence * 100)}%</span>
          ) : null}
        </div>
        <p className={cn(bodyTextClass, "mt-0.5 break-words")}>{check.assertion}</p>
        {check.evidenceKind ? (
          <p className={cn(secondaryTextClass, "mt-0.5 text-[11px]")}>{t(`groundingEvidenceKind.${check.evidenceKind}`)}</p>
        ) : null}
      </div>
    </PanelRow>
  )
}

export function VerificationPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const { data, isLoading, isError } = useGroundingChecksQuery(caseId)
  const [showChecked, setShowChecked] = useState(false)

  const { problems, clear } = useMemo(() => {
    const rows = data?.rows ?? []
    return {
      problems: rows.filter((r) => isProblem(r.verdict)),
      clear: rows.filter((r) => !isProblem(r.verdict)),
    }
  }, [data])

  if (isLoading) return <PanelBody gap="3"><EmptyNote>{t("groundingLoading")}</EmptyNote></PanelBody>
  if (isError) return <PanelBody gap="3"><EmptyNote>{t("groundingError")}</EmptyNote></PanelBody>

  const total = (data?.rows ?? []).length
  if (!total) {
    // Deliberately worded as "nothing checked", not "nothing wrong": the verifier is flag-gated on
    // the API, so an empty panel most often means it is switched off.
    return <PanelBody gap="3"><EmptyNote>{t("groundingEmpty")}</EmptyNote></PanelBody>
  }

  return (
    <PanelBody gap="3">
      <div>
        <SectionLabel>{t("groundingProblems", { count: problems.length })}</SectionLabel>
        <PanelRowList empty={<EmptyNote>{t("groundingNoProblems", { count: total })}</EmptyNote>}>
          {problems.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </PanelRowList>
      </div>

      {clear.length ? (
        <div>
          <button
            type="button"
            onClick={() => setShowChecked((v) => !v)}
            className={cn(labelTextClass, "mb-2 cursor-pointer hover:text-foreground")}
            aria-expanded={showChecked}
          >
            {showChecked ? t("groundingHideChecked") : t("groundingShowChecked", { count: clear.length })}
          </button>
          {showChecked ? (
            <PanelRowList>
              {clear.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </PanelRowList>
          ) : null}
        </div>
      ) : null}
    </PanelBody>
  )
}
