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

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">{children}</p>
  )
}

// `onClick`/`active` are only ever passed by SourcesPanel — `active` marks the one row the user
// last clicked (active-highlight.store.ts's activeHighlightId), so the panel itself shows what's
// selected, not just the yellow highlight landing in the chat transcript elsewhere. Both unset
// by DecisionDetailBody's own callers (the case-level Decisions panel, the chat drawer), whose
// rendering is unchanged.
export function EvidenceItem({
  evidence,
  onClick,
  active = false,
}: {
  evidence: DecisionEvidence
  onClick?: () => void
  active?: boolean
}) {
  const { t } = useTranslation("terminal")
  return (
    <li
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={`text-[12px] leading-4 text-muted-foreground ${onClick ? "cursor-pointer rounded-md p-1 -m-1 hover:bg-muted dark:hover:bg-overlay-hover" : ""} ${active ? "bg-brand-gold/10 ring-1 ring-inset ring-brand-gold/50" : ""}`}
    >
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

// Same onClick/active convention as EvidenceItem above — unset by every caller except
// SourcesPanel. The title stays its own independent link when `rule.url` is set (rule.verified
// already means chat-wonder resolved it against a real source — that link is worth keeping
// regardless of whether the row itself also jumps back to the reply).
export function RuleItem({
  rule,
  onClick,
  active = false,
}: {
  rule: DecisionRule
  onClick?: () => void
  active?: boolean
}) {
  return (
    <li
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={`flex items-center gap-1.5 text-[12px] text-muted-foreground ${onClick ? "cursor-pointer rounded-md p-1 -m-1 hover:bg-muted dark:hover:bg-overlay-hover" : ""} ${active ? "bg-brand-gold/10 ring-1 ring-inset ring-brand-gold/50" : ""}`}
    >
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
          onClick={(e) => e.stopPropagation()}
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

  // `payload` is chat-wonder's own JSON, stored verbatim with no runtime validation (see the
  // doc comment above) — the type above is a compile-time contract only. An off-spec generation
  // (e.g. `rule` coming back as a plain string instead of DecisionRule[]) must not crash this
  // whole drawer over one malformed field, so every array field is normalized before use rather
  // than trusted as-is. A field that isn't actually an array is treated as empty — not coerced
  // into a guessed shape, since fabricating e.g. a `verified` flag this app never audited would
  // violate the very anti-fabrication stance this component documents.
  const rules = Array.isArray(payload.rule) ? payload.rule : []
  const evidenceFor = Array.isArray(payload.evidenceFor) ? payload.evidenceFor : []
  const evidenceAgainst = Array.isArray(payload.evidenceAgainst) ? payload.evidenceAgainst : []
  const alternatives = Array.isArray(payload.alternatives) ? payload.alternatives : []
  const wouldChangeIf = Array.isArray(payload.wouldChangeIf) ? payload.wouldChangeIf : []

  return (
    <>
      {rules.length > 0 && (
        <div>
          <Label>{t("decisionRuleApplied")}</Label>
          <ul className="space-y-1">
            {rules.map((rule, i) => (
              <RuleItem key={i} rule={rule} />
            ))}
          </ul>
        </div>
      )}

      {(evidenceFor.length > 0 || evidenceAgainst.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {evidenceFor.length > 0 && (
            <div>
              <Label>{t("decisionEvidenceFor")}</Label>
              <ul className="space-y-1.5">
                {evidenceFor.map((ev, i) => (
                  <EvidenceItem key={i} evidence={ev} />
                ))}
              </ul>
            </div>
          )}
          {evidenceAgainst.length > 0 && (
            <div>
              <Label>{t("decisionEvidenceAgainst")}</Label>
              <ul className="space-y-1.5">
                {evidenceAgainst.map((ev, i) => (
                  <EvidenceItem key={i} evidence={ev} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {alternatives.length > 0 && (
        <div>
          <Label>{t("decisionAlternativeConsidered")}</Label>
          <ul className="space-y-1">
            {alternatives.map((alt, i) => (
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

      {wouldChangeIf.length > 0 && (
        <p className="flex items-start gap-1.5 text-[12px] leading-4 text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold text-foreground">{t("decisionWouldChangeIf")}: </span>
            {wouldChangeIf.join("; ")}
          </span>
        </p>
      )}
    </>
  )
}
