import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, ChevronDown, ChevronRight, FileX2, ShieldCheck } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { MessageGroundingCheck } from "@/lib/chat/mutations"

/**
 * One line under a legal answer saying what was checked against the case bundle and what failed
 * (ilovelawyer-api docs/plans/grounding-verifier.md). Expands to the individual problems.
 *
 * Only the problems are listed. A lawyer does not need to read forty confirmations to find the
 * one assertion the cited document contradicts — the confirmations are a count, the contradictions
 * are the content. The full record, including the passage each verdict was reached against, lives
 * in the Verification panel.
 *
 * Renders nothing when there is nothing to report: the verifier is flag-gated on the API, and a
 * "0 checked" line on every answer would be noise on installations that never enable it.
 */

const PROBLEM_VERDICTS = new Set(["CONTRADICTED", "FALSE_ABSENCE", "UNSUPPORTED"])

export function GroundingSummary({ checks }: { checks: MessageGroundingCheck[] | undefined }) {
  const { t } = useTranslation("homepage")
  const [open, setOpen] = useState(false)

  if (!checks?.length) return null

  const problems = checks.filter((c) => PROBLEM_VERDICTS.has(c.verdict))
  const contradicted = problems.filter((c) => c.verdict === "CONTRADICTED").length
  const falseAbsence = problems.filter((c) => c.verdict === "FALSE_ABSENCE").length

  const tone = contradicted || falseAbsence ? "text-destructive" : problems.length ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"
  const Icon = contradicted ? AlertTriangle : falseAbsence ? FileX2 : ShieldCheck

  return (
    <div className="mt-2 text-[12px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!problems.length}
        aria-expanded={open}
        className={cn("inline-flex items-center gap-1.5", tone, problems.length ? "cursor-pointer hover:underline" : "cursor-default")}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span>{t("grounding.summary", { checked: checks.length, problems: problems.length })}</span>
        {problems.length ? open ? <ChevronDown className="size-3" aria-hidden /> : <ChevronRight className="size-3" aria-hidden /> : null}
      </button>

      {open && problems.length ? (
        <ul className="mt-1.5 space-y-1.5 border-l-2 border-border pl-3">
          {problems.map((check) => (
            <li key={check.id}>
              <span className={cn("font-medium", check.verdict === "UNSUPPORTED" ? "text-amber-600 dark:text-amber-500" : "text-destructive")}>
                {t(`grounding.verdict.${check.verdict}`)}
              </span>
              {check.citation ? <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{check.citation}</span> : null}
              <p className="text-muted-foreground">{check.assertion}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
