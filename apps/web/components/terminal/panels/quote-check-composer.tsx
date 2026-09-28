import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Plus } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { useCheckCitationMutation } from "@/lib/terminal/mutations"
import {
  Field,
  MutationError,
  fieldClass,
  ghostBtnClass,
  primaryBtnClass,
} from "@/components/terminal/panel-kit"

// Same collapsed-composer pattern as AuthorityComposer. The quote is the only required input;
// the reference is what lets the check find the source, the rest is optional detail.
export function QuoteCheckComposer({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const check = useCheckCitationMutation(caseId)
  const uid = useId()
  const quoteRef = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [quotedText, setQuotedText] = useState("")
  const [citedReference, setCitedReference] = useState("")
  const [pinpoint, setPinpoint] = useState("")
  const [officialText, setOfficialText] = useState("")

  useEffect(() => {
    if (open) quoteRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setShowDetails(false)
    check.reset()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-[11px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-brand-gold/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none"
      >
        <Plus size={13} aria-hidden="true" />
        {t("checkQuote")}
      </button>
    )
  }

  return (
    <form
      className="flex shrink-0 flex-col gap-3 rounded-md border border-border bg-muted/40 p-3"
      onKeyDown={(e) => e.key === "Escape" && close()}
      onSubmit={(e) => {
        e.preventDefault()
        const quote = quotedText.trim()
        if (!quote) return
        check.mutate(
          {
            quotedText: quote,
            citedReference: citedReference.trim() || undefined,
            officialText: officialText.trim() || undefined,
            pinpoint: pinpoint.trim() || undefined,
          },
          {
            onSuccess: () => {
              setQuotedText("")
              setCitedReference("")
              setPinpoint("")
              setOfficialText("")
              close()
            },
          }
        )
      }}
    >
      <Field label={t("quote")} htmlFor={`${uid}-quote`}>
        <textarea
          ref={quoteRef}
          id={`${uid}-quote`}
          value={quotedText}
          onChange={(e) => setQuotedText(e.target.value)}
          placeholder={t("quoteExample")}
          rows={2}
          required
          className={`${fieldClass} h-auto resize-none py-1.5`}
        />
      </Field>

      <Field label={t("citedReference")} htmlFor={`${uid}-reference`} hint={t("citedReferenceHint")}>
        <input
          id={`${uid}-reference`}
          value={citedReference}
          onChange={(e) => setCitedReference(e.target.value)}
          placeholder={t("citedReferenceExample")}
          className={fieldClass}
        />
      </Field>

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        aria-expanded={showDetails}
        className="flex items-center gap-1 self-start rounded text-[11px] font-semibold text-brand-gold hover:underline focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none"
      >
        <ChevronDown size={12} aria-hidden="true" className={cn("transition-transform", showDetails && "rotate-180")} />
        {showDetails ? t("hideDetails") : t("addDetails")}
      </button>

      {showDetails && (
        <>
          <Field label={t("pinpoint")} htmlFor={`${uid}-pinpoint`}>
            <input
              id={`${uid}-pinpoint`}
              value={pinpoint}
              onChange={(e) => setPinpoint(e.target.value)}
              placeholder={t("pinpointExample")}
              className={fieldClass}
            />
          </Field>
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
        </>
      )}

      <MutationError show={check.isError} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={check.isPending || !quotedText.trim()} className={primaryBtnClass}>
          {check.isPending ? t("verifying") : t("verify")}
        </button>
        <button type="button" onClick={close} className={ghostBtnClass}>
          {t("cancel")}
        </button>
      </div>
    </form>
  )
}
