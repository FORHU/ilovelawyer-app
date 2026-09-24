import { CheckCircle2, ExternalLink, Info, Quote, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import type { DecisionAlternative, DecisionEvidence, DecisionRecordPayload, DecisionRule } from "@/lib/terminal/types"
import { displayDocumentLabel } from "@/lib/chat/document-label"

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
    <p className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">{children}</p>
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
      className={`min-w-0 text-[12px] leading-5 text-muted-foreground ${onClick ? "cursor-pointer rounded-md p-1 -m-1 hover:bg-muted dark:hover:bg-overlay-hover" : ""} ${active ? "bg-brand-gold/10 ring-1 ring-inset ring-brand-gold/50" : ""}`}
    >
      <div className="flex items-start gap-1.5">
        {evidence.verified ? (
          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" aria-hidden="true" />
        ) : (
          <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" aria-hidden="true" aria-label={t("decisionUnverified")} />
        )}
        {/* Document name and pinpoint are separate flex items (wrapping onto their own line when
         * the name is long) rather than inline spans — a long unbreakable filename like
         * CROWN-MED-001_Forensic_Medical_Report.pdf otherwise wraps mid-token and strands the
         * "· paragraph N" pinpoint beside it. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="min-w-0 font-medium text-foreground wrap-anywhere">
            {displayDocumentLabel(evidence.doc, t("decisionDocumentFallback", { defaultValue: "Document" }))}
          </span>
          {evidence.pinpoint && (
            <span className="shrink-0 rounded bg-muted px-1.5 text-[10.5px] leading-4 text-muted-foreground dark:bg-overlay-hover">
              {evidence.pinpoint}
            </span>
          )}
        </div>
      </div>
      {evidence.quote && (
        <blockquote className="mt-1 ml-4.5 flex items-start gap-1.5 border-l-2 border-border pl-2.5 italic">
          <Quote className="mt-1 h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 wrap-anywhere">{evidence.quote}</span>
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
    <li className="text-[12px] leading-5 text-muted-foreground">
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
    // `@container`: the evidence-for/against grid below needs to react to this component's own
    // rendered width, not the browser viewport — this body renders inside resizable desktop
    // panels (Legal Terminal) as well as the mobile Studio tab, where a viewport-based `sm:`
    // breakpoint would force two columns even while its actual box is a few hundred px wide.
    <div className="@container space-y-4">
      {rules.length > 0 && (
        <div>
          <Label>{t("decisionRuleApplied")}</Label>
          <ul className="space-y-1.5">
            {rules.map((rule, i) => (
              <RuleItem key={i} rule={rule} />
            ))}
          </ul>
        </div>
      )}

      {(evidenceFor.length > 0 || evidenceAgainst.length > 0) && (
        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
          {evidenceFor.length > 0 && (
            <div>
              <Label>{t("decisionEvidenceFor")}</Label>
              <ul className="space-y-2.5">
                {evidenceFor.map((ev, i) => (
                  <EvidenceItem key={i} evidence={ev} />
                ))}
              </ul>
            </div>
          )}
          {evidenceAgainst.length > 0 && (
            <div>
              <Label>{t("decisionEvidenceAgainst")}</Label>
              <ul className="space-y-2.5">
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
          <ul className="space-y-1.5">
            {alternatives.map((alt, i) => (
              <AlternativeItem key={i} alternative={alt} rejectedWhyLabel={t("decisionRejectedWhy")} />
            ))}
          </ul>
        </div>
      )}

      {payload.weighting && (
        <p className="text-[12px] leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">{t("decisionWeighting")}: </span>
          {payload.weighting}
        </p>
      )}

      {wouldChangeIf.length > 0 && (
        <div className="flex items-start gap-1.5 text-[12px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-foreground">{t("decisionWouldChangeIf")}:</span>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {wouldChangeIf.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
