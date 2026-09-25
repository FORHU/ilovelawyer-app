import { useState, type ComponentPropsWithoutRef } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, MapPin, Pencil, Quote, Trash2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { useCheckCitationMutation, useDeleteCitationMutation, useUpdateCitationMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot, SnapshotCitation } from "@/lib/terminal/types"
import {
  EmptyNote,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  SectionLabel,
  dangerIconBtnClass,
  fieldClass,
  ghostBtnClass,
  primaryBtnClass,
} from "@/components/terminal/panel-kit"

// A quote longer than this gets clamped with a show more/less toggle rather than left
// unreachable — line-clamp alone has no way to see the rest of the text.
const QUOTE_CLAMP_THRESHOLD = 160

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
  const check = useCheckCitationMutation(caseId)
  const [quotedText, setQuotedText] = useState("")
  const [citedReference, setCitedReference] = useState("")
  const [officialText, setOfficialText] = useState("")
  const [pinpoint, setPinpoint] = useState("")

  return (
    <PanelBody gap="4">
      <SectionLabel>{t("citations")}</SectionLabel>
      <PanelRowList empty={<EmptyNote>{t("noCitations")}</EmptyNote>}>
        {snapshot.law.citations.map((citation) => (
          <CitationRow key={citation.id} citation={citation} caseId={caseId} />
        ))}
      </PanelRowList>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const quote = quotedText.trim()
          if (!quote) return
          check.mutate({
            quotedText: quote,
            citedReference: citedReference.trim() || undefined,
            officialText: officialText.trim() || undefined,
            pinpoint: pinpoint.trim() || undefined,
          })
          setQuotedText("")
          setCitedReference("")
          setOfficialText("")
          setPinpoint("")
        }}
      >
        <textarea
          value={quotedText}
          onChange={(e) => setQuotedText(e.target.value)}
          placeholder={t("quote")}
          aria-label={t("quote")}
          rows={2}
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
        <button
          type="submit"
          disabled={check.isPending}
          className={`${primaryBtnClass} self-start`}
        >
          {t("verify")}
        </button>
      </form>
      <MutationError show={check.isError} />
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
