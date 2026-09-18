import { CheckCircle2, ExternalLink, Info, Quote, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import type { DecisionAlternative, DecisionEvidence, DecisionRecordPayload, DecisionRule } from "@/lib/terminal/types"

export const CONFIDENCE_KEYS: Record<DecisionRecordPayload["confidence"], string> = {
  high: "decisionConfidenceHigh",
  medium: "decisionConfidenceMedium",
  low: "decisionConfidenceLow",
}

const CONFIDENCE_TONE: Record<DecisionRecordPayload["confidence"], "success" | "warning" | "danger"> = {
  high: "success",
  medium: "warning",
  low: "danger",
}

export function DecisionConfidenceBadge({ confidence }: { confidence: DecisionRecordPayload["confidence"] }) {
  const { t } = useTranslation("terminal")
  return <Badge tone={CONFIDENCE_TONE[confidence]}>{t(CONFIDENCE_KEYS[confidence])}</Badge>
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">{children}</p>
  )
}

function EvidenceItem({ evidence }: { evidence: DecisionEvidence }) {
  const { t } = useTranslation("terminal")
  return (
    <li className="text-[12px] leading-4 text-muted-foreground">
      <div className="flex items-center gap-1.5">
        {evidence.verified ? (
          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden="true" />
        ) : (
          <XCircle className="h-3 w-3 shrink-0 text-red-400" aria-hidden="true" aria-label={t("decisionUnverified")} />
        )}
        <span className="font-medium text-foreground">{evidence.doc}</span>
        {evidence.pinpoint && <span className="text-muted-foreground">· {evidence.pinpoint}</span>}
      </div>
      {evidence.quote && (
        <blockquote className="mt-0.5 ml-4 flex items-start gap-1 border-l-2 border-border pl-2 italic">
          <Quote className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          {evidence.quote}
        </blockquote>
      )}
    </li>
  )
}

function RuleItem({ rule }: { rule: DecisionRule }) {
  return (
    <li className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
      {rule.verified ? (
        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden="true" />
      ) : (
        <XCircle className="h-3 w-3 shrink-0 text-red-400" aria-hidden="true" />
      )}
      {rule.url ? (
        <a
          href={rule.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-foreground underline decoration-dotted hover:text-brand-gold"
        >
          {rule.title}
          <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
        </a>
      ) : (
        <span>{rule.title}</span>
      )}
    </li>
  )
}

function AlternativeItem({ alternative, rejectedWhyLabel }: { alternative: DecisionAlternative; rejectedWhyLabel: string }) {
  return (
    <li className="text-[12px] leading-4 text-muted-foreground">
      <span className="text-foreground">{alternative.position}</span>
      {" — "}
      <span className="italic">
        {rejectedWhyLabel}: {alternative.whyRejected}
      </span>
    </li>
  )
}

/** The audited body of one Decision Record — rule, evidence for/against, alternatives
 * considered, weighting, and what would change it. Shared between the case-level Decisions
 * panel (terminal-panels.tsx, adds a conclusion/confidence header + dispute controls around
 * this) and the inline chat "Why?" drawer (which has no case row to dispute against, just the
 * per-message audited payload) — see docs/plans/differentiation-program.md Workstream A. Every
 * `verified` flag here was set by chat-wonder-v2-api's audit, never re-derived client-side. */
export function DecisionDetailBody({ payload }: { payload: DecisionRecordPayload }) {
  const { t } = useTranslation("terminal")

  return (
    <>
      {payload.rule.length > 0 && (
        <div>
          <Label>{t("decisionRuleApplied")}</Label>
          <ul className="space-y-1">
            {payload.rule.map((rule, i) => (
              <RuleItem key={i} rule={rule} />
            ))}
          </ul>
        </div>
      )}

      {(payload.evidenceFor.length > 0 || payload.evidenceAgainst.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {payload.evidenceFor.length > 0 && (
            <div>
              <Label>{t("decisionEvidenceFor")}</Label>
              <ul className="space-y-1.5">
                {payload.evidenceFor.map((ev, i) => (
                  <EvidenceItem key={i} evidence={ev} />
                ))}
              </ul>
            </div>
          )}
          {payload.evidenceAgainst.length > 0 && (
            <div>
              <Label>{t("decisionEvidenceAgainst")}</Label>
              <ul className="space-y-1.5">
                {payload.evidenceAgainst.map((ev, i) => (
                  <EvidenceItem key={i} evidence={ev} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {payload.alternatives.length > 0 && (
        <div>
          <Label>{t("decisionAlternativeConsidered")}</Label>
          <ul className="space-y-1">
            {payload.alternatives.map((alt, i) => (
              <AlternativeItem key={i} alternative={alt} rejectedWhyLabel={t("decisionRejectedWhy")} />
            ))}
          </ul>
        </div>
      )}

      {payload.weighting && (
        <p className="text-[12px] leading-4 text-muted-foreground">
          <span className="font-semibold text-foreground">{t("decisionWeighting")}: </span>
          {payload.weighting}
        </p>
      )}

      {payload.wouldChangeIf.length > 0 && (
        <p className="flex items-start gap-1.5 text-[12px] leading-4 text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold text-foreground">{t("decisionWouldChangeIf")}: </span>
            {payload.wouldChangeIf.join("; ")}
          </span>
        </p>
      )}
    </>
  )
}
