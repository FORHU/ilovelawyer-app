import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, CheckCircle2, ExternalLink, MapPin, Quote } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { useCheckCitationMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, SectionLabel, fieldClass, primaryBtnClass } from "@/components/terminal/panel-kit"

// A quote longer than this gets clamped with a show more/less toggle rather than left
// unreachable — line-clamp alone has no way to see the rest of the text.
const QUOTE_CLAMP_THRESHOLD = 160

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
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <PanelBody gap="4">
      <SectionLabel>{t("citations")}</SectionLabel>
      <PanelRowList empty={<EmptyNote>{t("noCitations")}</EmptyNote>}>
        {snapshot.law.citations.map((citation) => (
          <PanelRow key={citation.id} className="flex-col items-start gap-1.5">
            <p className={expandedId === citation.id ? "text-[13px] leading-5" : "line-clamp-3 text-[13px] leading-5"}>
              {citation.quotedText}
            </p>
            {citation.quotedText.length > QUOTE_CLAMP_THRESHOLD && (
              <button
                type="button"
                onClick={() => setExpandedId((cur) => (cur === citation.id ? null : citation.id))}
                className="text-[10px] font-semibold uppercase tracking-wide text-brand-gold hover:underline"
              >
                {expandedId === citation.id ? t("showLess") : t("showMore")}
              </button>
            )}
            {citation.citedReference && (
              <p className="text-[13px] text-muted-foreground">
                {citation.citedReference}
                {citation.pinpoint && `, ${citation.pinpoint}`}
              </p>
            )}
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
                <a
                  href={citation.resolvedAuthority.jurisUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
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
          </PanelRow>
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
