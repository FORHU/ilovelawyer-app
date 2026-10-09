import { useEffect, useRef, useState, type ComponentType } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { DocumentLink } from "@/components/shared/document-viewer"
import { useTranslation } from "react-i18next"
import { Check, FileText, Loader2, Paperclip, ShieldCheck, Sparkles, Trash2, TriangleAlert } from "lucide-react"
import {
  useAiJobStatus,
  useCreateFindingMutation,
  useCreateRiskMutation,
  useDeleteFindingMutation,
  useJevCheckFindingMutation,
  useUpdateFindingMutation,
  usePaneRegenerate,
  type PaneRegenerateAction,
} from "@/lib/terminal/mutations"
import { graphViewKeys } from "@/lib/graph-view/mutations"
import { useCaseDocumentUpload } from "@/lib/terminal/use-case-document-upload"
import { ALLOWED_EXTENSIONS } from "@/lib/cases/upload-batch"
import { useLinkedTodos } from "@/lib/terminal/linked-todos"
import { ToChecklistButton } from "@/components/terminal/to-checklist-button"
import type { TFunction } from "i18next"
import type { CaseFinding, FindingCategory, FindingTag } from "@/lib/terminal/types"
import {
  DeltaMark,
  EmptyNote,
  JevFlag,
  JevNotChecked,
  LlmFlag,
  LlmNotReviewed,
  MutationError,
  PaneLoadingState,
  RegenerateButton,
  PanelBody,
  PanelRow,
  PanelRowList,
  TONE_STYLE,
  CatalogPill,
  TagMixSummary,
  catalogBlurbClass,
  catalogDeltaClass,
  catalogRowClass,
  catalogSubClass,
  catalogTitleClass,
  dangerIconBtnClass,
  fieldClass,
  ghostBtnClass,
  primaryBtnClass,
  type Tone,
} from "@/components/terminal/panel-kit"
import { cn } from "@workspace/ui/lib/utils"

/** What makes one rated-finding panel (Legal Issues, Weaknesses, …) different from another. */
export interface RatedFindingConfig {
  category: FindingCategory
  /** The pane's own Regenerate: rewrites only this category's AI rows (usePaneRegenerate). */
  regenerate: PaneRegenerateAction
  introKey: string
  addKey: string
  detailPlaceholderKey: string
  /** The pills a lawyer can pick, in display order. */
  tags: { tag: FindingTag; tone: Tone; label: string }[]
  /** The pill whose share the ring shows (Resolved, Closed, Strong). */
  ringTag: FindingTag
  ringTitleKey: string
  /** The finished state, if the category has one: those rows fade and sink to the bottom. */
  doneTag?: FindingTag
  /** Sub-line when the row has no detail of its own (Strengths: the source document). */
  detailFallback?(finding: CaseFinding): string | null
  /** Mute the sub-line, from Jev's check (Strengths: a reference its source doesn't bear out) —
   * pair it with a subHintKey that says why. */
  dimSubLine?(jev: unknown): boolean
  /** Show the ▲ impact number, and which direction of it is bad. */
  impact?: { badWhenUp: boolean; titleKey: string }
  /** i18n keys for Jev's flags on a row; [] when none. */
  jevFlagKeys(jev: unknown): string[]
  /** i18n key for a hint after the row's sub-line, from Jev's check (Weaknesses: "No fix on record"). */
  subHintKey?(jev: unknown): string | null
  /** Jev's read, in the expanded row. */
  JevDetail: ComponentType<{ finding: CaseFinding }>
  /** Present the second check as an "AI review" in plain words (Legal Issues, Weaknesses,
   * Strengths) instead of the Jev wording the other finding panels still use. */
  llmWording?: boolean
  /** Show the attach-documents button beside the add field (Weaknesses, Strengths). */
  upload?: boolean
  /** "To checklist" sends the row to Case Strategy as a linked to-do. `fixedTag` is the pill that
   * settles the row: the button hides there, and the API ticks the to-do when the row reaches it
   * (keep in step with ilovelawyer-api utils/procedure-link.ts). `todoLabel` is the task the
   * to-do should say, when that isn't the row's own label. */
  checklist?: { fixedTag?: FindingTag; todoLabel?(finding: CaseFinding, t: TFunction<"terminal">): string }
}

const UNRATED = { tone: "neutral" as Tone, label: "findingUnrated" }

// Done sinks to the bottom; otherwise the order the API lists them in (position, then newest
// first) — re-applied here since the graph-view projection doesn't keep it.
function byPanelOrder(doneTag: FindingTag | undefined) {
  return (a: CaseFinding, b: CaseFinding) => {
    const done = doneTag ? Number(a.tag === doneTag) - Number(b.tag === doneTag) : 0
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
  const todos = useLinkedTodos(caseId)
  const flagRisk = useCreateRiskMutation(caseId)
  // Ids flagged from this panel this session, so a second click can't double-add.
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  // The row whose delete is waiting for a second click — same confirm step as citations.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // Findings from an older format regenerate in the background when the Terminal loads the case
  // (CaseFindingAiSvc.scheduleIfOutdated on the API). useAiJobStatus refreshes the snapshot when it
  // finishes; Legal Issues reads the graph view, so refresh that too.
  const findingsJob = useAiJobStatus(caseId, "caseFinding")
  // "Updating analysis" in the Terminal header is the caseRefresh pipeline, which regenerates the
  // findings after contradictions and Case Strategy — show the panel updating for the whole run,
  // not only once its findings step starts (same as the Timeline and Visual Strategy panels).
  const refreshJob = useAiJobStatus(caseId, "caseRefresh")
  const updating = findingsJob.data?.status === "IN_PROGRESS" || refreshJob.data?.status === "IN_PROGRESS"
  const regen = usePaneRegenerate(caseId, config.regenerate)
  const loadingLabel = updating ? t("paneUpdatingWithAnalysis") : regen.running ? t("paneRegenerating") : null
  const queryClient = useQueryClient()
  const prevJobStatus = useRef(findingsJob.data?.status)
  useEffect(() => {
    if (prevJobStatus.current === "IN_PROGRESS" && findingsJob.data?.status === "DONE") {
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    }
    prevJobStatus.current = findingsJob.data?.status
  }, [findingsJob.data?.status, caseId, queryClient])
  const prevRefreshStatus = useRef(refreshJob.data?.status)
  useEffect(() => {
    if (prevRefreshStatus.current === "IN_PROGRESS" && refreshJob.data?.status === "DONE") {
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    }
    prevRefreshStatus.current = refreshJob.data?.status
  }, [refreshJob.data?.status, caseId, queryClient])
  const [label, setLabel] = useState("")
  const [newTag, setNewTag] = useState<FindingTag | "">("")
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload, isUploading, canUpload } = useCaseDocumentUpload(caseId)

  const styleOf = (tag: FindingTag | null) => config.tags.find((s) => s.tag === tag) ?? null
  const rows = [...items].sort(byPanelOrder(config.doneTag))
  // Some rows Jev-checked and an AI row not means its call failed — say so on that row.
  const anyJev = rows.some((f) => f.jev)
  const counts = new Map<string, number>()
  rows.forEach((f) => {
    const key = styleOf(f.tag) ? f.tag! : "UNRATED"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  const inRing = counts.get(config.ringTag) ?? 0

  const toggle = (f: CaseFinding) => {
    setOpen(open === f.id ? null : f.id)
    setDetail(f.detail ?? "")
    jevCheck.reset()
  }
  const jevError = jevCheck.error as (Error & { status?: number }) | null

  return (
    <PanelBody gap="3">
      {/* The pane's own Regenerate rewrites only this category's AI rows; the case analysis
          rewrites every category whenever the documents change. */}
      <div className="flex items-start justify-between gap-3">
        <p className={catalogBlurbClass}>{t(config.introKey)}</p>
        <RegenerateButton regen={regen} />
      </div>
      {/* While a run writes this pane, the centered loading state replaces its content. */}
      {loadingLabel ? (
        <PaneLoadingState>{loadingLabel}</PaneLoadingState>
      ) : (
        <>
      {rows.length > 1 ? (
        <TagMixSummary
          catalog
          ring={{
            pct: Math.round((inRing / rows.length) * 100),
            tone: "ok",
            title: t(config.ringTitleKey, { done: inRing, total: rows.length }),
            label: (() => {
              const ringTagConfig = config.tags.find((s) => s.tag === config.ringTag)
              return ringTagConfig ? t(ringTagConfig.label) : undefined
            })(),
          }}
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
            const isDone = config.doneTag !== undefined && f.tag === config.doneTag
            const subLine = f.detail ?? config.detailFallback?.(f) ?? null
            const dim = f.jev && config.dimSubLine ? config.dimSubLine(f.jev) : false
            return (
              <PanelRow key={f.id} className={catalogRowClass}>
                <button
                  type="button"
                  onClick={() => toggle(f)}
                  aria-expanded={isOpen}
                  className={cn("flex w-full flex-wrap items-center justify-between gap-x-2.5 gap-y-1 text-left", isDone && "opacity-60")}
                >
                  {/* 8rem floor: in a narrow pane the delta and pill drop under the title instead of squeezing it. */}
                  <span className="min-w-0 flex-[1_1_8rem]">
                    <span className={cn("flex items-center gap-1.5", catalogTitleClass)}>
                      {f.label}
                      {flags.length > 0 ? (
                        config.llmWording ? (
                          <LlmFlag title={flags.map((key) => t(key)).join(" · ")} />
                        ) : (
                          <JevFlag title={flags.map((key) => t(key)).join(" · ")} />
                        )
                      ) : null}
                    </span>
                    {subLine || hint ? (
                      <span className={catalogSubClass}>
                        {/* Muted, not struck through: the review couldn't confirm it, which isn't the same as wrong. */}
                        {subLine ? <span className={cn(dim && "opacity-60")}>{subLine}</span> : null}
                        {subLine && hint ? " · " : null}
                        {hint ? <span className="text-warn">{t(hint)}</span> : null}
                      </span>
                    ) : null}
                  </span>
                  {config.impact && f.impact !== null ? (
                    <DeltaMark
                      value={f.impact}
                      badWhenUp={config.impact.badWhenUp}
                      title={t(config.impact.titleKey)}
                      className={catalogDeltaClass}
                    />
                  ) : null}
                  <CatalogPill tone={style.tone}>{t(style.label)}</CatalogPill>
                </button>

                {isOpen ? (
                  <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("findingStatus")}>
                      {config.tags.map((option) => (
                        <button
                          key={option.tag}
                          type="button"
                          // Picking the pill already set does nothing — a rating changes by picking another
                          // pill. Clicking it used to clear the rating, which left AI rows "Unrated" by accident.
                          onClick={() => option.tag !== f.tag && update.mutate({ id: f.id, tag: option.tag })}
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
                      className="flex flex-wrap gap-2"
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
                              <DocumentLink name={f.sourceLabel}>{t("groundedIn", { doc: f.sourceLabel })}</DocumentLink>
                            </span>
                          </span>
                        ) : null}
                      </p>
                    ) : null}

                    {f.jev ? (
                      <config.JevDetail finding={f} />
                    ) : anyJev && isAi ? (
                      config.llmWording ? <LlmNotReviewed /> : <JevNotChecked />
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                            {jevCheck.isPending
                              ? t(config.llmWording ? "llmReviewing" : "findingJevChecking")
                              : t(config.llmWording ? "llmRun" : "findingJevCheck")}
                          </button>
                        ) : null}
                        {/* Cross-panel: send this finding to Case Strategy's to-dos or the risk register. */}
                        {config.checklist && f.tag !== config.checklist.fixedTag ? (
                          <ToChecklistButton
                            todos={todos}
                            source={{ kind: "FINDING", id: f.id }}
                            label={config.checklist.todoLabel?.(f, t) ?? f.label}
                            sourceLabel={`${t(`findingCategory.${config.category}`)}: ${f.label}`.slice(0, 200)}
                          />
                        ) : null}
                        <button
                          type="button"
                          disabled={flagged.has(f.id) || flagRisk.isPending}
                          onClick={() =>
                            flagRisk.mutate(
                              { title: f.label, severity: "UNVERIFIED" },
                              { onSuccess: () => setFlagged((prev) => new Set(prev).add(f.id)) },
                            )
                          }
                          title={t("flagRiskHint")}
                          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground hover:text-riskmed disabled:opacity-60"
                        >
                          {flagged.has(f.id) ? (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                          )}
                          {flagged.has(f.id) ? t("riskFlagged") : t("flagRisk")}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(f.id)}
                        disabled={del.isPending}
                        className={dangerIconBtnClass}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    {confirmDelete === f.id && (
                      <div className="flex w-full flex-wrap items-center gap-2 rounded-md bg-danger/10 px-2.5 py-2">
                        <p className="min-w-0 flex-1 text-[12px] text-foreground">{t("deleteFindingConfirm")}</p>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          disabled={del.isPending}
                          className={ghostBtnClass}
                        >
                          {t("cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => del.mutate(f.id, { onSuccess: () => setConfirmDelete(null) })}
                          disabled={del.isPending}
                          className="h-8 shrink-0 rounded-md bg-danger px-3 text-[10px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-danger/85 disabled:opacity-50"
                        >
                          {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("delete")}
                        </button>
                      </div>
                    )}
                    <MutationError show={jevCheck.isError}>
                      {jevError?.status === 409
                        ? t(config.llmWording ? "llmOff" : "findingJevOff")
                        : t(config.llmWording ? "llmFailed" : "findingJevFailed")}
                    </MutationError>
                  </div>
                ) : null}
              </PanelRow>
            )
          })}
        </PanelRowList>
      </div>

      <form
        className="mt-auto flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = label.trim()
          if (!value) return
          create.mutate({ category: config.category, label: value, tag: newTag || null })
          setLabel("")
          setNewTag("")
        }}
      >
        {config.upload && canUpload ? (
          <>
            {/* Uploads go to the case's one document pool (same as the Evidence pane), which the
                automatic analysis then reads — findings aren't stored per-document. */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                e.target.value = ""
                if (files.length > 0) upload(files)
              }}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              aria-label={t("uploadDocuments")}
              title={t("uploadDocuments")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:cursor-wait disabled:opacity-60"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </>
        ) : null}
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t(config.addKey)}
          aria-label={t(config.addKey)}
          className={`min-w-0 flex-[1_1_8rem] ${fieldClass}`}
        />
        <select
          value={newTag}
          onChange={(e) => setNewTag(e.target.value as FindingTag | "")}
          aria-label={t("findingStatus")}
          className={`min-w-0 flex-[1_1_7rem] @sm:w-28 @sm:flex-none ${fieldClass}`}
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
      <MutationError show={create.isError || update.isError || del.isError || todos.isError || flagRisk.isError} />
        </>
      )}
    </PanelBody>
  )
}

/** i18n key of the pill the drafting model gave a row Jev re-rated — null when Jev kept it. */
export function modelTagLabelKey(finding: CaseFinding, config: RatedFindingConfig): string | null {
  if (!finding.modelTag || finding.modelTag === finding.tag) return null
  return config.tags.find((s) => s.tag === finding.modelTag)?.label ?? UNRATED.label
}
