import { useState, type ComponentPropsWithoutRef } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, MapPin, Pencil, Quote, Sparkles, Trash2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import {
  useDeleteCitationMutation,
  useRemoveAuthorityMutation,
  useUpdateAuthorityMutation,
  useUpdateCitationMutation,
} from "@/lib/terminal/mutations"
import type {
  AuthorityStance,
  CaseSnapshot,
  SnapshotAuthority,
  SnapshotAuthoritySummary,
  SnapshotCitation,
} from "@/lib/terminal/types"
import {
  EmptyNote,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  SectionLabel,
  bodyTextClass,
  dangerIconBtnClass,
  fieldClass,
  ghostBtnClass,
  labelTextClass,
  primaryBtnClass,
  secondaryTextClass,
} from "@/components/terminal/panel-kit"
import { AuthorityComposer, STANCES } from "@/components/terminal/panels/authority-composer"
import { QuoteCheckComposer } from "@/components/terminal/panels/quote-check-composer"

// A quote longer than this gets clamped with a show more/less toggle rather than left
// unreachable — line-clamp alone has no way to see the rest of the text.
const QUOTE_CLAMP_THRESHOLD = 160

// Mirrors AUTHORITY_JEV_MIN_CONFIDENCE in the API (authority-stance-jev.ts): below it Jev's read is noise.
const JEV_MIN_CONFIDENCE = 0.7

const STANCE_BADGE_TONE = { STATUTE: "neutral", ON_POINT: "success", ADVERSE: "danger" } as const
const STANCE_BAR_CLASS = { STATUTE: "bg-muted-foreground/40", ON_POINT: "bg-ok", ADVERSE: "bg-danger" } as const
const STANCE_SUMMARY_KEY = { STATUTE: "statute", ON_POINT: "onPoint", ADVERSE: "adverse" } as const

const RING_RADIUS = 15.9155 // circumference ≈ 100, so the dash length is the percentage
function CoverageRing({ coverage }: { coverage: number | null }) {
  const pct = coverage === null ? 0 : Math.round(coverage * 100)
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={RING_RADIUS} fill="none" strokeWidth="3.5" className="stroke-border" />
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${pct} 100`}
          className="stroke-ok"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">
        {coverage === null ? "—" : `${pct}%`}
      </span>
    </div>
  )
}

function AuthoritySummaryHeader({ summary }: { summary: SnapshotAuthoritySummary }) {
  const { t } = useTranslation("terminal")
  return (
    <div className="flex items-center gap-3">
      <CoverageRing coverage={summary.coverage} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted" role="presentation">
          {STANCES.map((stance) => {
            const count = summary[STANCE_SUMMARY_KEY[stance]]
            return count > 0 ? (
              <div key={stance} className={STANCE_BAR_CLASS[stance]} style={{ flexGrow: count }} />
            ) : null
          })}
        </div>
        <div className={`flex flex-wrap gap-x-3 gap-y-0.5 ${labelTextClass}`}>
          {STANCES.map((stance) => (
            <span key={stance}>
              {t(`authorityStance.${stance}`)} {summary[STANCE_SUMMARY_KEY[stance]]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
// Same shape as the shared danger icon button (delete), with a neutral hover for a non-destructive action.
const editIconBtnClass =
  "shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground disabled:opacity-50"

export function LawPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const updateAuthority = useUpdateAuthorityMutation(caseId)
  const removeAuthority = useRemoveAuthorityMutation(caseId)

  const { authorities, summary } = snapshot.law
  const grounds = snapshot.findings.filter((finding) => finding.category === "LEGAL_ISSUE")
  const groundLabel = (authority: SnapshotAuthority) =>
    grounds.find((ground) => ground.id === authority.findingId)?.label

  return (
    <PanelBody gap="4">
      <div className="flex flex-col gap-3">
        <AuthoritySummaryHeader summary={summary} />
        <PanelRowList empty={<EmptyNote>{t("noAuthorities")}</EmptyNote>}>
          {authorities.map((authority) => (
            <PanelRow key={authority.id} className="flex-col items-start gap-1.5">
              <div className="flex w-full items-start justify-between gap-2">
                <div className="min-w-0">
                  {authority.resolvedAuthority ? (
                    <a
                      href={authority.resolvedAuthority.jurisUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`${bodyTextClass} inline-flex items-center gap-1 hover:underline`}
                    >
                      {authority.title}
                      <ExternalLink size={10} aria-hidden="true" />
                    </a>
                  ) : (
                    <p className={bodyTextClass}>{authority.title}</p>
                  )}
                  {(authority.subtitle || authority.citation) && (
                    <p className={labelTextClass}>
                      {[authority.subtitle, authority.citation].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <Badge tone={STANCE_BADGE_TONE[authority.stance]} shape="pill">
                  {t(`authorityStance.${authority.stance}`)}
                </Badge>
              </div>
              {authority.rationale && <p className={secondaryTextClass}>{authority.rationale}</p>}
              {authority.jevStance && (authority.jevConfidence ?? 0) >= JEV_MIN_CONFIDENCE && (
                authority.jevStance === authority.stance ? (
                  <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
                    <Sparkles size={10} aria-hidden="true" />
                    {t("jevAgrees")}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateAuthority.mutate({ id: authority.id, stance: authority.jevStance! })}
                    disabled={updateAuthority.isPending}
                    className="flex items-center gap-1.5 rounded-md border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-left text-[11px] text-foreground transition-colors hover:bg-brand-gold/20 focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none disabled:opacity-50"
                  >
                    <Sparkles size={11} className="shrink-0 text-brand-gold" aria-hidden="true" />
                    <span>
                      {t("jevSuggests", {
                        stance: t(`authorityStance.${authority.jevStance}`),
                        pct: Math.round((authority.jevConfidence ?? 0) * 100),
                      })}
                    </span>
                    <span className="font-semibold text-brand-gold uppercase">{t("jevApply")}</span>
                  </button>
                )
              )}
              {groundLabel(authority) && (
                <p className={labelTextClass}>
                  {t("authorityGround")}: {groundLabel(authority)}
                </p>
              )}
              <div className="flex items-center gap-2">
                <select
                  value={authority.stance}
                  onChange={(e) =>
                    updateAuthority.mutate({ id: authority.id, stance: e.target.value as AuthorityStance })
                  }
                  aria-label={t("authorityStanceLabel")}
                  className={fieldClass}
                >
                  {STANCES.map((stance) => (
                    <option key={stance} value={stance}>
                      {t(`authorityStance.${stance}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeAuthority.mutate(authority.id)}
                  disabled={removeAuthority.isPending}
                  aria-label={t("removeAuthority")}
                  className={dangerIconBtnClass}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </PanelRow>
          ))}
        </PanelRowList>
        <AuthorityComposer caseId={caseId} grounds={grounds} />
        <MutationError show={updateAuthority.isError || removeAuthority.isError} />
      </div>
      <SectionLabel>{t("quoteCheck")}</SectionLabel>
      <PanelRowList empty={<EmptyNote>{t("noCitations")}</EmptyNote>}>
        {snapshot.law.citations.map((citation) => (
          <CitationRow key={citation.id} citation={citation} caseId={caseId} />
        ))}
      </PanelRowList>
      <QuoteCheckComposer caseId={caseId} />
    </PanelBody>
  )
}

// Forwards the rest of the <li> props (PanelRowList tags each row with data-row-key to animate
// it in/out), so it can stand in for a bare PanelRow.
function CitationRow({
  citation,
  caseId,
  ...rest
}: { citation: SnapshotCitation; caseId: string } & ComponentPropsWithoutRef<"li">) {
  const { t } = useTranslation("terminal")
  const update = useUpdateCitationMutation(caseId)
  const del = useDeleteCitationMutation(caseId)
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view")
  const [expanded, setExpanded] = useState(false)

  const [quotedText, setQuotedText] = useState(citation.quotedText)
  const [citedReference, setCitedReference] = useState(citation.citedReference ?? "")
  const [pinpoint, setPinpoint] = useState(citation.pinpoint ?? "")
  const [officialText, setOfficialText] = useState(citation.officialText ?? "")

  // Re-seeded from the citation each time editing starts, so a cancelled edit (or a newer server
  // version, e.g. after a re-verify) never leaves stale text sitting in the form.
  const startEdit = () => {
    setQuotedText(citation.quotedText)
    setCitedReference(citation.citedReference ?? "")
    setPinpoint(citation.pinpoint ?? "")
    setOfficialText(citation.officialText ?? "")
    update.reset()
    setMode("edit")
  }

  if (mode === "edit") {
    return (
      <PanelRow className="flex-col items-stretch gap-2" {...rest}>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const quote = quotedText.trim()
            if (!quote) return
            // Every field is sent (blank as "") so emptying a box actually clears it server-side.
            update.mutate(
              { id: citation.id, quotedText: quote, citedReference: citedReference.trim(), pinpoint: pinpoint.trim(), officialText: officialText.trim() },
              { onSuccess: () => setMode("view") },
            )
          }}
        >
          <textarea
            value={quotedText}
            onChange={(e) => setQuotedText(e.target.value)}
            placeholder={t("quote")}
            aria-label={t("quote")}
            rows={3}
            autoFocus
            className={`resize-none py-1.5 ${fieldClass} h-auto`}
          />
          <input
            value={citedReference}
            onChange={(e) => setCitedReference(e.target.value)}
            placeholder={t("citedReference")}
            aria-label={t("citedReference")}
            className={fieldClass}
          />
          <input
            value={pinpoint}
            onChange={(e) => setPinpoint(e.target.value)}
            placeholder={t("pinpoint")}
            aria-label={t("pinpoint")}
            className={fieldClass}
          />
          <input
            value={officialText}
            onChange={(e) => setOfficialText(e.target.value)}
            placeholder={t("officialText")}
            aria-label={t("officialText")}
            className={fieldClass}
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={update.isPending || !quotedText.trim()} className={primaryBtnClass}>
              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("save")}
            </button>
            <button type="button" onClick={() => setMode("view")} disabled={update.isPending} className={ghostBtnClass}>
              {t("cancel")}
            </button>
          </div>
          <MutationError show={update.isError} />
        </form>
      </PanelRow>
    )
  }

  return (
    <PanelRow className="flex-col items-start gap-1.5" {...rest}>
      <div className="flex w-full items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <p className={expanded ? "text-[13px] leading-5" : "line-clamp-3 text-[13px] leading-5"}>{citation.quotedText}</p>
          {citation.quotedText.length > QUOTE_CLAMP_THRESHOLD && (
            <button
              type="button"
              onClick={() => setExpanded((cur) => !cur)}
              className="text-[10px] font-semibold uppercase tracking-wide text-brand-gold hover:underline"
            >
              {expanded ? t("showLess") : t("showMore")}
            </button>
          )}
          {citation.citedReference && (
            <p className="text-[13px] text-muted-foreground">
              {citation.citedReference}
              {citation.pinpoint && `, ${citation.pinpoint}`}
            </p>
          )}
        </div>
        {mode === "view" && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={startEdit} className={editIconBtnClass} aria-label={t("editCitation")} title={t("editCitation")}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setMode("confirmDelete")} className={dangerIconBtnClass} aria-label={t("deleteCitation")} title={t("deleteCitation")}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral" shape="pill">
          {citation.status}
        </Badge>
        {citation.propositionType && (
          <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
            <Quote size={10} />
            {t(`propositionType.${citation.propositionType}`)}
          </p>
        )}
        {citation.pinpoint && (
          <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
            <MapPin size={10} />
            {citation.pinpoint}
          </p>
        )}
      </div>
      {citation.citedReference &&
        (citation.resolvedAuthority ? (
          <a href={citation.resolvedAuthority.jurisUrl} target="_blank" rel="noreferrer" className="hover:underline">
            <Badge tone="success" shape="pill">
              <CheckCircle2 size={11} />
              {t("authorityVerified")}
              <ExternalLink size={10} />
            </Badge>
          </a>
        ) : (
          <Badge tone="caution" shape="pill">
            <AlertTriangle size={11} />
            {t("authorityNotVerified")}
          </Badge>
        ))}
      {mode === "confirmDelete" && (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-md bg-danger/10 px-2.5 py-2">
          <p className="min-w-0 flex-1 text-[12px] text-foreground">{t("deleteCitationConfirm")}</p>
          <button type="button" onClick={() => setMode("view")} disabled={del.isPending} className={ghostBtnClass}>
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => del.mutate(citation.id, { onSuccess: () => setMode("view") })}
            disabled={del.isPending}
            className="h-8 shrink-0 rounded-md bg-danger px-3 text-[10px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-danger/85 disabled:opacity-50"
          >
            {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("delete")}
          </button>
        </div>
      )}
      <MutationError show={del.isError} />
    </PanelRow>
  )
}
