import { useState, type ComponentType } from "react"
import { useTranslation } from "react-i18next"
import { FileText, Loader2, ShieldCheck, Sparkles, Trash2 } from "lucide-react"
import {
  useCreateFindingMutation,
  useDeleteFindingMutation,
  useJevCheckFindingMutation,
  useUpdateFindingMutation,
} from "@/lib/terminal/mutations"
import type { CaseFinding, FindingCategory, FindingTag } from "@/lib/terminal/types"
import {
  DeltaMark,
  EmptyNote,
  JevFlag,
  JevNotChecked,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  TONE_STYLE,
  TagMixSummary,
  TonePill,
  dangerIconBtnClass,
  fieldClass,
  ghostBtnClass,
  labelTextClass,
  primaryBtnClass,
  type Tone,
} from "@/components/terminal/panel-kit"
import { cn } from "@workspace/ui/lib/utils"

/** What makes one rated-finding panel (Legal Issues, Weaknesses, …) different from another. */
export interface RatedFindingConfig {
  category: FindingCategory
  introKey: string
  addKey: string
  detailPlaceholderKey: string
  /** The pills a lawyer can pick, in display order. */
  tags: { tag: FindingTag; tone: Tone; label: string }[]
  /** The finished state: fades, sinks to the bottom, and the ring shows its share. */
  doneTag: FindingTag
  ringTitleKey: string
  /** Show the ▲ impact number, and which direction of it is bad. */
  impact?: { badWhenUp: boolean; titleKey: string }
  /** i18n keys for Jev's flags on a row; [] when none. */
  jevFlagKeys(jev: unknown): string[]
  /** i18n key for a hint after the row's sub-line, from Jev's check (Weaknesses: "No fix on record"). */
  subHintKey?(jev: unknown): string | null
  /** Jev's read, in the expanded row. */
  JevDetail: ComponentType<{ finding: CaseFinding }>
}

const UNRATED = { tone: "neutral" as Tone, label: "findingUnrated" }

// Done sinks to the bottom; otherwise the order the API lists them in (position, then newest
// first) — re-applied here since the graph-view projection doesn't keep it.
function byPanelOrder(doneTag: FindingTag) {
  return (a: CaseFinding, b: CaseFinding) => {
    const done = Number(a.tag === doneTag) - Number(b.tag === doneTag)
    if (done) return done
    if (a.position !== null && b.position !== null) return a.position - b.position
    if (a.position !== null) return -1
    if (b.position !== null) return 1
    return b.createdAt.localeCompare(a.createdAt)
  }
}

// The shared body of the panels whose rows carry a pill, a sub-line and Jev's check: an intro, the
// done-share ring and tag mix, rows that expand to set the pill, edit the sub-line, read Jev's
// check and run one on request, and the add form. Each panel supplies its rows and its config.
export function RatedFindingPanel({
  caseId,
  items,
  config,
}: {
  caseId: string
  items: CaseFinding[]
  config: RatedFindingConfig
}) {
  const { t } = useTranslation("terminal")
  const create = useCreateFindingMutation(caseId)
  const update = useUpdateFindingMutation(caseId)
  const del = useDeleteFindingMutation(caseId)
  const jevCheck = useJevCheckFindingMutation(caseId)
  const [label, setLabel] = useState("")
  const [newTag, setNewTag] = useState<FindingTag | "">("")
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState("")

  const styleOf = (tag: FindingTag | null) => config.tags.find((s) => s.tag === tag) ?? null
  const rows = [...items].sort(byPanelOrder(config.doneTag))
  // Some rows Jev-checked and an AI row not means its call failed — say so on that row.
  const anyJev = rows.some((f) => f.jev)
  const counts = new Map<string, number>()
  rows.forEach((f) => {
    const key = styleOf(f.tag) ? f.tag! : "UNRATED"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  const done = counts.get(config.doneTag) ?? 0

  const toggle = (f: CaseFinding) => {
    setOpen(open === f.id ? null : f.id)
    setDetail(f.detail ?? "")
    jevCheck.reset()
  }
  const jevError = jevCheck.error as (Error & { status?: number }) | null

  return (
    <PanelBody gap="4">
      <p className="text-[13px] text-muted-foreground">{t(config.introKey)}</p>

      {rows.length > 1 ? (
        <TagMixSummary
          ring={{ pct: Math.round((done / rows.length) * 100), tone: "ok", title: t(config.ringTitleKey, { done, total: rows.length }) }}
          segments={[...config.tags.map((s) => ({ key: s.tag as string, ...s })), { key: "UNRATED", ...UNRATED }].map((s) => ({
            key: s.key,
            label: t(s.label),
            count: counts.get(s.key) ?? 0,
            tone: s.tone,
          }))}
        />
      ) : null}

      {/* Same shrink-0 wrapper as WitnessPanel: PanelRowList's <ul> is overflow-hidden. */}
      <div className="shrink-0">
        <PanelRowList empty={<EmptyNote>{t("noFindings")}</EmptyNote>}>
          {rows.map((f) => {
            const style = styleOf(f.tag) ?? UNRATED
            const flags = f.jev ? config.jevFlagKeys(f.jev) : []
            const hint = f.jev && config.subHintKey ? config.subHintKey(f.jev) : null
            const isOpen = open === f.id
            const isAi = f.notes === "AI"
            const isDone = f.tag === config.doneTag
            return (
              <PanelRow key={f.id} className="flex-col items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => toggle(f)}
                  aria-expanded={isOpen}
                  className={cn("flex w-full items-center justify-between gap-3 text-left", isDone && "opacity-60")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                      {f.label}
                      {flags.length > 0 ? <JevFlag title={flags.map((key) => t(key)).join(" · ")} /> : null}
                    </span>
                    {f.detail || hint ? (
                      <span className={`mt-0.5 block ${labelTextClass}`}>
                        {f.detail}
                        {f.detail && hint ? " · " : null}
                        {hint ? <span className="text-warn">{t(hint)}</span> : null}
                      </span>
                    ) : null}
                  </span>
                  {config.impact && f.impact !== null ? (
                    <DeltaMark value={f.impact} badWhenUp={config.impact.badWhenUp} title={t(config.impact.titleKey)} />
                  ) : null}
                  <TonePill tone={style.tone}>{t(style.label)}</TonePill>
                </button>

                {isOpen ? (
                  <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("findingStatus")}>
                      {config.tags.map((option) => (
                        <button
                          key={option.tag}
                          type="button"
                          onClick={() => update.mutate({ id: f.id, tag: option.tag === f.tag ? null : option.tag })}
                          disabled={update.isPending}
                          aria-pressed={option.tag === f.tag}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px] transition-colors disabled:opacity-50",
                            option.tag !== f.tag
                              ? "border-border text-muted-foreground hover:text-foreground"
                              : option.tone === "neutral"
                                ? // The neutral pill's bg-muted would vanish on this bg-muted box.
                                  "border-foreground/30 bg-background text-foreground"
                                : TONE_STYLE[option.tone].badge,
                          )}
                        >
                          {t(option.label)}
                        </button>
                      ))}
                    </div>

                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        update.mutate({ id: f.id, detail: detail.trim() || null })
                      }}
                    >
                      <input
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        placeholder={t(config.detailPlaceholderKey)}
                        aria-label={t(config.detailPlaceholderKey)}
                        className={`flex-1 ${fieldClass}`}
                      />
                      <button
                        type="submit"
                        disabled={update.isPending || detail.trim() === (f.detail ?? "")}
                        className={ghostBtnClass}
                      >
                        {t("save")}
                      </button>
                    </form>

                    {isAi || f.sourceLabel ? (
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {isAi ? (
                          <span className="inline-flex items-center gap-1 font-semibold tracking-[1px] text-brand-gold uppercase">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            {t("aiGenerated")}
                          </span>
                        ) : null}
                        {f.sourceLabel ? (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate" title={f.sourceLabel}>
                              {t("groundedIn", { doc: f.sourceLabel })}
                            </span>
                          </span>
                        ) : null}
                      </p>
                    ) : null}

                    {f.jev ? <config.JevDetail finding={f} /> : anyJev && isAi ? <JevNotChecked /> : null}

                    <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                      {/* Lawyer-entered rows get Jev's read on request; AI ones were read when generated. */}
                      {!isAi ? (
                        <button
                          type="button"
                          onClick={() => jevCheck.mutate(f.id)}
                          disabled={jevCheck.isPending}
                          className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
                        >
                          {jevCheck.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          )}
                          {jevCheck.isPending ? t("findingJevChecking") : t("findingJevCheck")}
                        </button>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => del.mutate(f.id)}
                        disabled={del.isPending}
                        className={dangerIconBtnClass}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <MutationError show={jevCheck.isError}>
                      {jevError?.status === 409 ? t("findingJevOff") : t("findingJevFailed")}
                    </MutationError>
                  </div>
                ) : null}
              </PanelRow>
            )
          })}
        </PanelRowList>
      </div>

      <form
        className="mt-auto flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = label.trim()
          if (!value) return
          create.mutate({ category: config.category, label: value, tag: newTag || null })
          setLabel("")
          setNewTag("")
        }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t(config.addKey)}
          aria-label={t(config.addKey)}
          className={`min-w-0 flex-1 ${fieldClass}`}
        />
        <select
          value={newTag}
          onChange={(e) => setNewTag(e.target.value as FindingTag | "")}
          aria-label={t("findingStatus")}
          className={`w-28 shrink-0 ${fieldClass}`}
        >
          <option value="">{t("findingStatus")}</option>
          {config.tags.map((option) => (
            <option key={option.tag} value={option.tag}>
              {t(option.label)}
            </option>
          ))}
        </select>
        <button type="submit" disabled={create.isPending} className={primaryBtnClass}>
          {t("add")}
        </button>
      </form>
      <MutationError show={create.isError || update.isError || del.isError} />
    </PanelBody>
  )
}

/** i18n key of the pill the drafting model gave a row Jev re-rated — null when Jev kept it. */
export function modelTagLabelKey(finding: CaseFinding, config: RatedFindingConfig): string | null {
  if (!finding.modelTag || finding.modelTag === finding.tag) return null
  return config.tags.find((s) => s.tag === finding.modelTag)?.label ?? UNRATED.label
}
