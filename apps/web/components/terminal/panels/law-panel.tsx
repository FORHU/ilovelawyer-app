import { useId, useState, type ComponentPropsWithoutRef } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, MapPin, Pencil, Quote, Sparkles, Trash2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  useDeleteCitationMutation,
  useRemoveAuthorityMutation,
  useUpdateAuthorityMutation,
  useUpdateCitationMutation,
  usePaneRegenerate,
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
  Field,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  TONE_STYLE,
  TonePill,
  type Tone,
  bodyTextClass,
  dangerIconBtnClass,
  editIconBtnClass,
  fieldClass,
  ghostBtnClass,
  labelTextClass,
  primaryBtnClass,
  secondaryTextClass,
  RegenerateButton,
  PaneLoadingState,
  usePaneLoadingLabel,
  catalogBlurbClass,
} from "@/components/terminal/panel-kit"
import { AuthorityComposer, STANCES } from "@/components/terminal/panels/authority-composer"
import { QuoteCheckComposer } from "@/components/terminal/panels/quote-check-composer"

// A quote longer than this gets clamped with a show more/less toggle rather than left
// unreachable — line-clamp alone has no way to see the rest of the text.
const QUOTE_CLAMP_THRESHOLD = 160

// Mirrors AUTHORITY_JEV_MIN_CONFIDENCE in the API (authority-stance-jev.ts): below it Jev's read is noise.
const JEV_MIN_CONFIDENCE = 0.7

const STANCE_BADGE_TONE = { STATUTE: "neutral", ON_POINT: "success", ADVERSE: "danger" } as const
// Statute is gold (not gray) so the badge reads as "has content"; Badge has no gold tone, so override it.
const STATUTE_BADGE_CLASS = "bg-brand-gold/15 text-brand-gold"
const STANCE_BAR_CLASS = { STATUTE: "bg-brand-gold", ON_POINT: "bg-ok", ADVERSE: "bg-danger" } as const
// Does the quote match its source: VALID yes; INVALID no; ADVERSE the source says the opposite.
const CITATION_STATUS_TONE: Record<SnapshotCitation["status"], Tone> = {
  VALID: "ok",
  INVALID: "danger",
  ADVERSE: "danger",
  UNVERIFIED: "neutral",
}
const STANCE_SUMMARY_KEY ={ STATUTE: "statute", ON_POINT: "onPoint", ADVERSE: "adverse" } as const

const RING_RADIUS = 15.9155 // circumference ≈ 100, so the dash length is the percentage
function CoverageRing({ summary }: { summary: SnapshotAuthoritySummary }) {
  const { coverage, groundsSupported, groundsTotal } = summary
  const pct = coverage === null ? 0 : Math.round(coverage * 100)
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={RING_RADIUS} fill="none" strokeWidth="3.5" className="stroke-border" />
        {/* Skipped at 0%: a zero-length dash with a round linecap still paints a dot. */}
        {pct > 0 && (
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
        )}
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums ${pct > 0 ? "" : "text-muted-foreground"}`}>
        {coverage === null ? "—" : `${groundsSupported}/${groundsTotal}`}
      </span>
    </div>
  )
}

function AuthoritySummaryHeader({ summary }: { summary: SnapshotAuthoritySummary }) {
  const { t } = useTranslation("terminal")
  return (
    <div className="flex items-center gap-3">
      <CoverageRing summary={summary} />
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
        <div className={`${labelTextClass}`}>
          {summary.coverage === null
            ? t("authorityGroundsNone")
            : t("authorityGroundsSupported", { supported: summary.groundsSupported, total: summary.groundsTotal })}
          {summary.unlinked > 0 && summary.coverage !== null && (
            <span className="text-warn"> · {t("authorityUnlinked", { count: summary.unlinked })}</span>
          )}
          {summary.groundsContested > 0 && (
            <span className="text-danger"> · {t("authorityGroundsContested", { count: summary.groundsContested })}</span>
          )}
        </div>
      </div>
    </div>
  )
}

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
  const regen = usePaneRegenerate(caseId, "legalIssues")
  const loadingLabel = usePaneLoadingLabel(regen)
  const groundLabel = (authority: SnapshotAuthority) =>
    grounds.find((ground) => ground.id === authority.findingId)?.label

  return (
    <PanelBody gap="4">
      <div className="flex flex-col gap-3">
        {/* The grounds an authority is pinned to are the case's legal-issue findings, so this
            pane's Regenerate is Legal Issues' (which updates too). */}
        <div className="flex items-start justify-between gap-3">
          <p className={catalogBlurbClass}>{t("lawGroundsNote", { count: grounds.length })}</p>
          <RegenerateButton regen={regen} hint={t("regenerateGroundsHint")} />
        </div>
      {loadingLabel ? (
        <PaneLoadingState>{loadingLabel}</PaneLoadingState>
      ) : (
        <>
        <AuthoritySummaryHeader summary={summary} />
        <PanelRowList empty={<EmptyNote>{t("noAuthorities")}</EmptyNote>}>
          {authorities.map((authority) => (
            <AuthorityRow
              key={authority.id}
              authority={authority}
              grounds={grounds}
              groundLabel={groundLabel(authority)}
              onStanceChange={(stance) => updateAuthority.mutate({ id: authority.id, stance })}
              onRemove={() => removeAuthority.mutate(authority.id)}
              stancePending={updateAuthority.isPending}
              removePending={removeAuthority.isPending}
              caseId={caseId}
            />
          ))}
        </PanelRowList>
        <AuthorityComposer caseId={caseId} grounds={grounds} />
        <MutationError show={updateAuthority.isError || removeAuthority.isError} />
        </>
      )}
      </div>
      <div className="flex items-baseline justify-between gap-2 border-t border-border pt-4">
        <p className={labelTextClass}>{t("quoteCheck")}</p>
        {snapshot.law.citations.length > 0 && (
          <span className={`${labelTextClass} tabular-nums`}>{snapshot.law.citations.length}</span>
        )}
      </div>
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
// it in/out), same as CitationRow. The stance select and Jev's suggestion stay one click in view
// mode; the pencil opens the rest of the row (title, citation, subtitle, why it matters, ground)
// for editing — the API re-resolves the citation on save, so the source link follows the edit.
function AuthorityRow({
  authority,
  grounds,
  groundLabel,
  onStanceChange,
  onRemove,
  stancePending,
  removePending,
  caseId,
  ...rest
}: {
  authority: SnapshotAuthority
  grounds: CaseSnapshot["findings"]
  groundLabel: string | undefined
  onStanceChange: (stance: AuthorityStance) => void
  onRemove: () => void
  stancePending: boolean
  removePending: boolean
  caseId: string
} & ComponentPropsWithoutRef<"li">) {
  const { t } = useTranslation("terminal")
  const update = useUpdateAuthorityMutation(caseId)
  const [editing, setEditing] = useState(false)
  const uid = useId()

  const [title, setTitle] = useState(authority.title)
  const [citation, setCitation] = useState(authority.citation ?? "")
  const [subtitle, setSubtitle] = useState(authority.subtitle ?? "")
  const [rationale, setRationale] = useState(authority.rationale ?? "")
  const [ground, setGround] = useState(authority.findingId ?? "")

  // Re-seeded each time editing starts, so a cancelled edit (or a newer server version) never
  // leaves stale text in the form.
  const startEdit = () => {
    setTitle(authority.title)
    setCitation(authority.citation ?? "")
    setSubtitle(authority.subtitle ?? "")
    setRationale(authority.rationale ?? "")
    setGround(authority.findingId ?? "")
    update.reset()
    setEditing(true)
  }

  if (editing) {
    return (
      <PanelRow className="flex-col items-stretch gap-2" {...rest}>
        <form
          className="flex flex-col gap-3"
          onKeyDown={(e) => e.key === "Escape" && !update.isPending && setEditing(false)}
          onSubmit={(e) => {
            e.preventDefault()
            const value = title.trim()
            if (!value) return
            // Every field is sent (blank as "") so emptying a box actually clears it server-side.
            update.mutate(
              {
                id: authority.id,
                title: value,
                citation: citation.trim(),
                subtitle: subtitle.trim(),
                rationale: rationale.trim(),
                findingId: ground || null,
              },
              { onSuccess: () => setEditing(false) },
            )
          }}
        >
          <Field label={t("authorityTitle")} htmlFor={`${uid}-title`}>
            <input
              id={`${uid}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("authorityTitleExample")}
              autoFocus
              required
              className={fieldClass}
            />
          </Field>
          <Field label={t("authorityCitation")} htmlFor={`${uid}-citation`} hint={t("authorityCitationHint")}>
            <input
              id={`${uid}-citation`}
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              placeholder={t("authorityCitationExample")}
              className={fieldClass}
            />
          </Field>
          <Field label={t("authoritySubtitle")} htmlFor={`${uid}-subtitle`}>
            <input
              id={`${uid}-subtitle`}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={t("authoritySubtitleExample")}
              className={fieldClass}
            />
          </Field>
          <Field label={t("authorityRationale")} htmlFor={`${uid}-rationale`}>
            <textarea
              id={`${uid}-rationale`}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder={t("authorityRationaleExample")}
              rows={2}
              className={`${fieldClass} h-auto resize-none py-1.5`}
            />
          </Field>
          {grounds.length > 0 && (
            <Field label={t("authorityGround")} htmlFor={`${uid}-ground`}>
              <select id={`${uid}-ground`} value={ground} onChange={(e) => setGround(e.target.value)} className={fieldClass}>
                <option value="">{t("authorityNoGround")}</option>
                {grounds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <MutationError show={update.isError} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={update.isPending || !title.trim()} className={primaryBtnClass}>
              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("save")}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={update.isPending} className={ghostBtnClass}>
              {t("cancel")}
            </button>
          </div>
        </form>
      </PanelRow>
    )
  }

  return (
    <PanelRow className="flex-col items-start gap-1.5" {...rest}>
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
            <p className={labelTextClass}>{[authority.subtitle, authority.citation].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <Badge
          tone={STANCE_BADGE_TONE[authority.stance]}
          shape="pill"
          className={authority.stance === "STATUTE" ? STATUTE_BADGE_CLASS : undefined}
        >
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
            onClick={() => onStanceChange(authority.jevStance!)}
            disabled={stancePending}
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
      {groundLabel && (
        <p className={labelTextClass}>
          {t("authorityGround")}: {groundLabel}
        </p>
      )}
      <div className="flex items-center gap-2">
        <select
          value={authority.stance}
          onChange={(e) => onStanceChange(e.target.value as AuthorityStance)}
          aria-label={t("authorityStanceLabel")}
          className={fieldClass}
        >
          {STANCES.map((stance) => (
            <option key={stance} value={stance}>
              {t(`authorityStance.${stance}`)}
            </option>
          ))}
        </select>
        <button type="button" onClick={startEdit} aria-label={t("editAuthority")} title={t("editAuthority")} className={editIconBtnClass}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={removePending}
          aria-label={t("removeAuthority")}
          title={t("removeAuthority")}
          className={dangerIconBtnClass}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </PanelRow>
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
  const uid = useId()

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
      <PanelRow className="@container flex-col items-stretch gap-2" {...rest}>
        <form
          className="flex flex-col gap-3"
          onKeyDown={(e) => e.key === "Escape" && !update.isPending && setMode("view")}
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
          <Field label={t("quote")} htmlFor={`${uid}-quote`}>
            <textarea
              id={`${uid}-quote`}
              value={quotedText}
              onChange={(e) => setQuotedText(e.target.value)}
              rows={3}
              autoFocus
              required
              className={`${fieldClass} h-auto resize-none py-1.5`}
            />
          </Field>
          {/* Reference and pinpoint side by side once the row is wide enough — a pinpoint is short. */}
          <div className="grid grid-cols-1 gap-3 @xs:grid-cols-[1fr_7.5rem]">
            <Field label={t("citedReference")} htmlFor={`${uid}-reference`}>
              <input
                id={`${uid}-reference`}
                value={citedReference}
                onChange={(e) => setCitedReference(e.target.value)}
                placeholder={t("citedReferenceExample")}
                className={fieldClass}
              />
            </Field>
            <Field label={t("pinpoint")} htmlFor={`${uid}-pinpoint`}>
              <input
                id={`${uid}-pinpoint`}
                value={pinpoint}
                onChange={(e) => setPinpoint(e.target.value)}
                placeholder={t("pinpointExample")}
                className={fieldClass}
              />
            </Field>
          </div>
          <Field label={t("officialText")} htmlFor={`${uid}-official`} hint={t("officialTextHint")}>
            <textarea
              id={`${uid}-official`}
              value={officialText}
              onChange={(e) => setOfficialText(e.target.value)}
              placeholder={t("officialTextExample")}
              rows={2}
              className={`${fieldClass} h-auto resize-none py-1.5`}
            />
          </Field>
          <MutationError show={update.isError} />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={update.isPending || !quotedText.trim()} className={primaryBtnClass}>
              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("save")}
            </button>
            <button type="button" onClick={() => setMode("view")} disabled={update.isPending} className={ghostBtnClass}>
              {t("cancel")}
            </button>
          </div>
        </form>
      </PanelRow>
    )
  }

  const tone = CITATION_STATUS_TONE[citation.status]
  const metaClass = "flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase"

  return (
    <PanelRow className="group/citation flex-col items-stretch gap-2" {...rest}>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          <TonePill tone={tone}>{t(`citationStatus.${citation.status}`)}</TonePill>
          {citation.propositionType && (
            <span className={metaClass}>
              <Quote size={10} aria-hidden="true" />
              {t(`propositionType.${citation.propositionType}`)}
            </span>
          )}
        </div>
        {mode === "view" && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity focus-within:opacity-100 group-hover/citation:opacity-100">
            <button type="button" onClick={startEdit} className={editIconBtnClass} aria-label={t("editCitation")} title={t("editCitation")}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setMode("confirmDelete")} className={dangerIconBtnClass} aria-label={t("deleteCitation")} title={t("deleteCitation")}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* The quote, set off like a blockquote and edged in the check's tone, so a mismatch reads
       * at a glance without hunting for the pill. */}
      <blockquote className={cn("flex flex-col items-start gap-1 border-l-2 pl-3", TONE_STYLE[tone].edge)}>
        <p className={cn("text-[13px] leading-5 text-foreground", !expanded && "line-clamp-3")}>
          “{citation.quotedText}”
        </p>
        {citation.quotedText.length > QUOTE_CLAMP_THRESHOLD && (
          <button
            type="button"
            onClick={() => setExpanded((cur) => !cur)}
            className="text-[10px] font-semibold uppercase tracking-wide text-brand-gold hover:underline"
          >
            {expanded ? t("showLess") : t("showMore")}
          </button>
        )}
      </blockquote>

      {/* Where the quote comes from, with whether the authority itself was found (separate from
       * whether the quote matches it — that's the pill above). */}
      {citation.citedReference && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
          {citation.resolvedAuthority ? (
            <a
              href={citation.resolvedAuthority.jurisUrl}
              target="_blank"
              rel="noreferrer"
              title={`${t("authorityVerified")}: ${citation.resolvedAuthority.title}`}
              className="inline-flex min-w-0 items-center gap-1 text-foreground hover:underline"
            >
              <CheckCircle2 size={12} className="shrink-0 text-ok" aria-hidden="true" />
              <span className="sr-only">{t("authorityVerified")}:</span>
              <span className="truncate">{citation.citedReference}</span>
              <ExternalLink size={10} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          ) : (
            <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground" title={t("authorityNotVerified")}>
              <AlertTriangle size={12} className="shrink-0 text-warn" aria-hidden="true" />
              <span className="sr-only">{t("authorityNotVerified")}:</span>
              <span className="truncate">{citation.citedReference}</span>
            </span>
          )}
          {citation.pinpoint && (
            <span className={metaClass}>
              <MapPin size={10} aria-hidden="true" />
              {citation.pinpoint}
            </span>
          )}
        </div>
      )}

      {citation.notes && <p className="text-[12px] leading-5 text-muted-foreground">{citation.notes}</p>}
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
