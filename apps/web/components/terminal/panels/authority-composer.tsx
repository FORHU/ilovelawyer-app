import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Plus } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { useAddAuthorityMutation } from "@/lib/terminal/mutations"
import type { AuthorityStance, CaseFinding } from "@/lib/terminal/types"
import {
  Field,
  MutationError,
  fieldClass,
  ghostBtnClass,
  labelTextClass,
  primaryBtnClass,
} from "@/components/terminal/panel-kit"

export const STANCES: AuthorityStance[] = ["STATUTE", "ON_POINT", "ADVERSE"]

// Same hues as the badges in the authority list, so the choice made here is what shows up there.
const STANCE_ACTIVE: Record<AuthorityStance, string> = {
  STATUTE: "bg-foreground/10 text-foreground",
  ON_POINT: "bg-ok/15 text-ok",
  ADVERSE: "bg-danger/15 text-danger",
}

// Collapsed to one button until needed, so the list stays the focus of the panel. Type is not
// asked for: the stance toggle carries it (Statute → a statute, On point / Adverse → a case).
export function AuthorityComposer({ caseId, grounds }: { caseId: string; grounds: CaseFinding[] }) {
  const { t } = useTranslation("terminal")
  const add = useAddAuthorityMutation(caseId)
  const uid = useId()
  const titleRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [stance, setStance] = useState<AuthorityStance>("ON_POINT")
  const [title, setTitle] = useState("")
  const [citation, setCitation] = useState("")
  const [rationale, setRationale] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [ground, setGround] = useState("")

  useEffect(() => {
    if (open) titleRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setShowDetails(false)
    add.reset()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-[11px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-brand-gold/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none"
      >
        <Plus size={13} aria-hidden="true" />
        {t("addAuthority")}
      </button>
    )
  }

  return (
    <form
      className="flex shrink-0 flex-col gap-3 rounded-md border border-border bg-muted/40 p-3"
      onKeyDown={(e) => e.key === "Escape" && close()}
      onSubmit={(e) => {
        e.preventDefault()
        const trimmed = title.trim()
        if (!trimmed) return
        add.mutate(
          {
            kind: stance === "STATUTE" ? "STATUTE" : "CASE",
            stance,
            title: trimmed,
            subtitle: subtitle.trim() || undefined,
            citation: citation.trim() || undefined,
            rationale: rationale.trim() || undefined,
            findingId: ground || undefined,
          },
          {
            onSuccess: () => {
              setTitle("")
              setCitation("")
              setRationale("")
              setSubtitle("")
              setGround("")
              setStance("ON_POINT")
              close()
            },
          }
        )
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span id={`${uid}-stance`} className={labelTextClass}>
          {t("authorityStanceLabel")}
        </span>
        <div
          role="radiogroup"
          aria-labelledby={`${uid}-stance`}
          className="grid grid-cols-3 gap-0.5 rounded-md border border-border bg-background p-0.5"
        >
          {STANCES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={stance === value}
              onClick={() => setStance(value)}
              className={cn(
                "h-7 rounded text-[10px] font-semibold uppercase tracking-[1px] transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none",
                stance === value ? STANCE_ACTIVE[value] : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`authorityStance.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <Field label={t("authorityTitle")} htmlFor={`${uid}-title`}>
        <input
          ref={titleRef}
          id={`${uid}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("authorityTitleExample")}
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

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        aria-expanded={showDetails}
        className={cn(
          "flex items-center gap-1 self-start rounded text-[11px] font-semibold text-brand-gold hover:underline focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none"
        )}
      >
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn("transition-transform", showDetails && "rotate-180")}
        />
        {showDetails ? t("hideDetails") : t("addDetails")}
      </button>

      {showDetails && (
        <>
          <Field label={t("authoritySubtitle")} htmlFor={`${uid}-subtitle`}>
            <input
              id={`${uid}-subtitle`}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={t("authoritySubtitleExample")}
              className={fieldClass}
            />
          </Field>
          {grounds.length > 0 && (
            <Field label={t("authorityGround")} htmlFor={`${uid}-ground`}>
              <select
                id={`${uid}-ground`}
                value={ground}
                onChange={(e) => setGround(e.target.value)}
                className={fieldClass}
              >
                <option value="">{t("authorityNoGround")}</option>
                {grounds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}

      <MutationError show={add.isError} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={add.isPending || !title.trim()} className={primaryBtnClass}>
          {add.isPending ? t("saving") : t("addAuthority")}
        </button>
        <button type="button" onClick={close} className={ghostBtnClass}>
          {t("cancel")}
        </button>
      </div>
    </form>
  )
}
