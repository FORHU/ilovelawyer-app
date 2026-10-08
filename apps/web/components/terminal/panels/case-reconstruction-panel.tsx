import { Fragment, useEffect, useRef, useState } from "react"
import { DocumentLink } from "@/components/shared/document-viewer"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Check, ChevronRight, Copy, FileText, Loader2, Pencil, Quote, Save, Sparkles } from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { Badge } from "@workspace/ui/components/badge"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"
import AttributedMarkdown, { AttributedTextLegend, type ClaimCategory } from "@/components/shared/attributed-text"
import {
  useAiJobStatus,
  useGenerateReconstructionEventsMutation,
  useGenerateReconstructionScenesMutation,
  useUpdateReconstructionMutation,
  usePaneRegenerate,
} from "@/lib/terminal/mutations"
import type { UpdateReconstructionPayload } from "@/lib/terminal/mutations"
import type {
  CaseSnapshot,
  ReconstructionEvent,
  ReconstructionEventBlocker,
  ReconstructionEventStatus,
  ReconstructionEvents,
  SceneDetail,
} from "@/lib/terminal/types"
import {
  EmptyNote,
  MutationError,
  PaneLoadingState,
  PanelBody,
  SectionLabel,
  ghostBtnClass,
  primaryBtnClass,
  secondaryTextClass,
  RegenerateButton,
} from "@/components/terminal/panel-kit"

type ReconstructionRegister = "general" | "court" | "opposing"

const REGISTER_TAB_KEYS: Record<ReconstructionRegister, string> = {
  general: "registerGeneral",
  court: "registerCourt",
  opposing: "registerOpposing",
}

function registerText(
  reconstruction: CaseSnapshot["reconstruction"],
  register: ReconstructionRegister
): string {
  if (!reconstruction) return ""
  if (register === "general") return reconstruction.narrative
  if (register === "court") return reconstruction.narrativeCourt ?? ""
  return reconstruction.narrativeOpposing ?? ""
}

function buildUpdatePayload(
  register: ReconstructionRegister,
  text: string
): UpdateReconstructionPayload {
  if (register === "general") return { narrative: text }
  if (register === "court") return { narrativeCourt: text }
  return { narrativeOpposing: text }
}

const RECONSTRUCTION_VIEW_MODE_KEYS = {
  narrative: "viewModeNarrative",
  scenes: "viewModeScenes",
  storyboard: "viewModeStoryboard",
  events: "viewModeEvents",
} as const

export function CaseReconstructionPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const reconstruction = snapshot.reconstruction
  const narrative = reconstruction?.narrative ?? ""

  const [activeRegister, setActiveRegister] =
    useState<ReconstructionRegister>("general")
  // General-register-only: the narrative is claim-attributed (see backend's [CLAIMS] block), so
  // it defaults to a read-only highlighted view; editing is a deliberate switch, same tradeoff
  // Red Team avoids by not being editable at all. Court/Opposing have no claims and stay
  // textarea-only, same as before this feature.
  const [isEditingGeneral, setIsEditingGeneral] = useState(false)
  const [drafts, setDrafts] = useState<Record<ReconstructionRegister, string>>({
    general: registerText(reconstruction, "general"),
    court: registerText(reconstruction, "court"),
    opposing: registerText(reconstruction, "opposing"),
  })
  const [dirty, setDirty] = useState<Record<ReconstructionRegister, boolean>>({
    general: false,
    court: false,
    opposing: false,
  })
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<
    "narrative" | "scenes" | "storyboard" | "events"
  >("narrative")

  const update = useUpdateReconstructionMutation(caseId)
  const generateJob = useAiJobStatus(caseId, "caseReconstruction")
  const isGenerating = generateJob.data?.status === "IN_PROGRESS"
  // The analysis refresh writes the narrative and rewrites it until the lawyer edits any register
  // (CaseReconstructionSvc.autoRegenerate on the API). The pane's own Regenerate rewrites it on
  // demand; on an edited narrative it asks first, since it replaces the lawyer's words.
  const edited = !!reconstruction?.narrativeEditedAt
  const regen = usePaneRegenerate(caseId, "reconstruction")
  const loadingLabel = regen.busy && !edited ? t("paneUpdatingWithAnalysis") : regen.running || isGenerating ? t("paneRegenerating") : null
  const [confirmReplace, setConfirmReplace] = useState(false)

  // Generate is queued server-side (AiGenerationQueue / SQS) — the mutation's response is just
  // the AiGenerationJob row, not the finished narrative, so drafts can no longer be set from its
  // onSuccess. Instead: note the IN_PROGRESS -> DONE transition, then resync drafts once
  // `reconstruction` itself reflects the refetched snapshot — which may land a render or two
  // after the transition, once useAiJobStatus's own invalidate resolves — hence the two effects
  // rather than reading `reconstruction` directly in the one that watches job status.
  const prevGenerateJobStatus = useRef(generateJob.data?.status)
  const pendingDraftSyncRef = useRef(false)
  useEffect(() => {
    if (
      prevGenerateJobStatus.current === "IN_PROGRESS" &&
      generateJob.data?.status === "DONE"
    ) {
      pendingDraftSyncRef.current = true
    }
    prevGenerateJobStatus.current = generateJob.data?.status
  }, [generateJob.data?.status])
  // The analysis refresh can regenerate the narrative while the lawyer is mid-edit, so a register
  // with unsaved changes keeps its draft; the others take the new text.
  useEffect(() => {
    if (!pendingDraftSyncRef.current) return
    pendingDraftSyncRef.current = false
    setDrafts((prev) => ({
      general: dirty.general ? prev.general : registerText(reconstruction, "general"),
      court: dirty.court ? prev.court : registerText(reconstruction, "court"),
      opposing: dirty.opposing ? prev.opposing : registerText(reconstruction, "opposing"),
    }))
    if (!dirty.general) setIsEditingGeneral(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on new content, reads the dirty flags it lands on
  }, [reconstruction])

  const sourceLabels = [
    ...new Set((reconstruction?.claims ?? []).map((c) => c.sourceLabel).filter((l): l is string => !!l)),
  ]
  const activeDraft = drafts[activeRegister]
  const activeDirty = dirty[activeRegister]
  const activeText = registerText(reconstruction, activeRegister)

  return (
    <PanelBody gap="3">
      <div className="flex items-start justify-between gap-3">
        <SectionLabel>{t("reconstructionNarrative")}</SectionLabel>
        <RegenerateButton
          regen={regen}
          onClick={() => (edited ? setConfirmReplace(true) : regen.start())}
          hint={t("regenerateReconstructionHint")}
        />
      </div>
      {/* While a run writes this pane, the centered loading state replaces its content. */}
      {loadingLabel ? (
        <PaneLoadingState>{loadingLabel}</PaneLoadingState>
      ) : (
        <>
      {edited ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className={secondaryTextClass}>{t("reconstructionEditedNote")}</p>
          {confirmReplace ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("reconstructionConfirmRegenerate")}>
              <span className="text-[12px] text-foreground">{t("reconstructionConfirmRegenerate")}</span>
              <button
                type="button"
                onClick={() => {
                  setConfirmReplace(false)
                  regen.start()
                }}
                className={primaryBtnClass}
              >
                {t("reconstructionReplaceEdits")}
              </button>
              <button type="button" onClick={() => setConfirmReplace(false)} className={ghostBtnClass}>
                {t("cancel")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div role="tablist" className="flex w-full max-w-md flex-wrap gap-0.5 self-start rounded-md bg-muted p-0.5">
        {(["narrative", "scenes", "storyboard", "events"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={viewMode === mode}
            onClick={() => setViewMode(mode)}
            className={`min-w-0 flex-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 ${
              viewMode === mode
                ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/5"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {t(RECONSTRUCTION_VIEW_MODE_KEYS[mode])}
          </button>
        ))}
      </div>

      {viewMode === "scenes" && (
        <ScenesView caseId={caseId} reconstruction={reconstruction} />
      )}
      {viewMode === "storyboard" && (
        <StoryboardView
          reconstruction={reconstruction}
          documents={snapshot.documents}
        />
      )}
      {viewMode === "events" && (
        <EventsView
          caseId={caseId}
          reconstructionEvents={snapshot.reconstructionEvents}
          documents={snapshot.documents}
        />
      )}

      {viewMode === "narrative" && (
        <div className="grid items-start gap-x-10 gap-y-6 @4xl:grid-cols-[minmax(0,66ch)_minmax(16rem,22rem)]">
          <div className="flex min-w-0 flex-col gap-3">
          <div role="tablist" className="flex flex-wrap gap-x-4 border-b border-border">
            {(Object.keys(REGISTER_TAB_KEYS) as ReconstructionRegister[]).map(
              (register) => (
                <button
                  key={register}
                  type="button"
                  role="tab"
                  aria-selected={activeRegister === register}
                  onClick={() => setActiveRegister(register)}
                  className={`-mb-px border-b-2 py-1.5 text-xs transition-colors outline-none focus-visible:text-foreground ${
                    activeRegister === register
                      ? "border-brand-gold font-medium text-foreground"
                      : "border-transparent text-foreground/70 hover:text-foreground"
                  }`}
                >
                  {t(REGISTER_TAB_KEYS[register])}
                </button>
              )
            )}
          </div>
          <p className="text-xs text-foreground/70">{t(`${REGISTER_TAB_KEYS[activeRegister]}Hint`)}</p>

          {!narrative && !isGenerating ? (
            <EmptyNote>{t("noReconstruction")}</EmptyNote>
          ) : activeRegister !== "general" && !activeText && !activeDirty ? (
            <EmptyNote>{t("registerNotGenerated")}</EmptyNote>
          ) : activeRegister === "general" && !isEditingGeneral ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-foreground/70 tabular-nums">
                    {t("readTimeMinutes", { n: Math.max(1, Math.round(activeDraft.split(/\s+/).length / 200)) })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(activeDraft).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      })
                    }}
                    className={`inline-flex shrink-0 items-center gap-1.5 ${ghostBtnClass}`}
                  >
                    {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
                    {copied ? t("copiedText") : t("copyText")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingGeneral(true)}
                    className={`inline-flex shrink-0 items-center gap-1.5 ${ghostBtnClass}`}
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                    {t("edit")}
                  </button>
                </div>
              </div>
              <div>
                <AttributedMarkdown
                  content={activeDraft}
                  claims={reconstruction?.claims ?? []}
                />
              </div>
            </div>
          ) : (
            <textarea
              key={activeRegister}
              value={activeDraft}
              onChange={(e) => {
                setDrafts((prev) => ({
                  ...prev,
                  [activeRegister]: e.target.value,
                }))
                setDirty((prev) => ({ ...prev, [activeRegister]: true }))
              }}
              rows={16}
              className="flex-1 rounded-md border border-border bg-muted px-3 py-2.5 text-[13px] leading-6 text-foreground outline-none focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
            />
          )}

          {activeDirty && (
            <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-border bg-card px-1 py-2">
              <button
                type="button"
                onClick={() => {
                  setDrafts((prev) => ({ ...prev, [activeRegister]: activeText }))
                  setDirty((prev) => ({ ...prev, [activeRegister]: false }))
                  if (activeRegister === "general") setIsEditingGeneral(false)
                }}
                disabled={update.isPending}
                className={ghostBtnClass}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() =>
                  update.mutate(buildUpdatePayload(activeRegister, activeDraft), {
                    onSuccess: () => {
                      setDirty((prev) => ({ ...prev, [activeRegister]: false }))
                      if (activeRegister === "general") setIsEditingGeneral(false)
                    },
                  })
                }
                disabled={update.isPending}
                className={`inline-flex items-center gap-1.5 ${primaryBtnClass}`}
              >
                {update.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-3 w-3" aria-hidden="true" />
                )}
                {update.isPending ? t("saving") : t("save")}
              </button>
            </div>
          )}
          <MutationError show={update.isError} />
          </div>

          {/* Record rail: sits beside the prose on wide panes (the prose keeps its reading measure),
              and stacks under it on narrow ones. */}
          <aside className="flex min-w-0 flex-col gap-4 @4xl:sticky @4xl:top-0">
          {reconstruction?.claims?.length ? (
            <div className="flex flex-col gap-2 @4xl:border-l @4xl:border-border @4xl:pl-5">
              <SectionLabel>{t("reconstructionSources")}</SectionLabel>
              <AttributedTextLegend
                className="flex-col items-start gap-y-1.5"
                counts={reconstruction.claims.reduce<Partial<Record<ClaimCategory, number>>>((acc, c) => {
                  acc[c.category] = (acc[c.category] ?? 0) + 1
                  return acc
                }, {})}
              />
              {sourceLabels.length > 0 && (
                <ul className="mt-1 space-y-1 text-[12px] leading-5 text-foreground/70">
                  {sourceLabels.map((label) => (
                    <li key={label} className="flex items-start gap-1.5">
                      <FileText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">{label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {reconstruction && reconstruction.gaps.length > 0 && (
            <details open className="group border-t border-border pt-3 @4xl:border-l @4xl:border-t-0 @4xl:pt-0 @4xl:pl-5">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-foreground outline-none focus-visible:text-brand-gold">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden="true" />
                {t("reconstructionGaps")}
                <span className="text-foreground/70">{reconstruction.gaps.length}</span>
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-8 text-[12px] leading-5 text-foreground/70">
                {reconstruction.gaps.map((gap, index) => (
                  <li key={index}>{gap}</li>
                ))}
              </ul>
            </details>
          )}
          </aside>
        </div>
      )}
        </>
      )}
    </PanelBody>
  )
}

// Shape-matched placeholder while a generate job runs with nothing to show yet.
function RowSkeletons() {
  return (
    <div className="space-y-4 motion-safe:animate-pulse" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-2/5 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-4/5 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function SceneConfidenceBadge({
  confidence,
}: {
  confidence: SceneDetail["confidence"]
}) {
  const { t } = useTranslation("terminal")
  const tone = confidence === "high" ? "success" : confidence === "medium" ? "warning" : "danger"
  return (
    <Badge tone={tone}>
      {t(
        confidence === "high"
          ? "decisionConfidenceHigh"
          : confidence === "medium"
            ? "decisionConfidenceMedium"
            : "decisionConfidenceLow"
      )}
    </Badge>
  )
}

function ScenesView({
  caseId,
  reconstruction,
}: {
  caseId: string
  reconstruction: CaseSnapshot["reconstruction"]
}) {
  const { t } = useTranslation("terminal")
  const scenes = reconstruction?.scenes ?? null

  const generateScenes = useGenerateReconstructionScenesMutation(caseId)
  const scenesJob = useAiJobStatus(caseId, "caseReconstructionScenes")
  const isGeneratingScenes =
    generateScenes.isPending || scenesJob.data?.status === "IN_PROGRESS"

  const scenesListRef = useRef<HTMLUListElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  // Fires once per successful (re)generate — `isSuccess` flips false→true only on an actual
  // mutation resolving, never on an ordinary mount where scenes were already there from a prior
  // session, so freshly-generated scenes get a reveal moment without animating on every visit.
  useGSAP(
    () => {
      if (!generateScenes.isSuccess || reducedMotion) return
      const rows = scenesListRef.current?.children
      if (rows?.length) gsap.from(rows, { opacity: 0, y: 8, duration: 0.3, stagger: 0.06, ease: "power2.out" })
    },
    { dependencies: [generateScenes.isSuccess, reducedMotion] },
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>{t("scenesLabel")}</SectionLabel>
        <button
          type="button"
          onClick={() => generateScenes.mutate()}
          disabled={isGeneratingScenes}
          className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
        >
          {isGeneratingScenes ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {isGeneratingScenes
            ? t("generating")
            : scenes?.length
              ? t("regenerateScenes")
              : t("generateScenes")}
        </button>
      </div>
      {/* The job's own failure too: the pane's Regenerate and the case analysis also build scenes. */}
      <MutationError show={generateScenes.isError || (!isGeneratingScenes && scenesJob.data?.status === "FAILED")} />

      {!scenes || scenes.length === 0 ? (
        isGeneratingScenes ? <RowSkeletons /> : <EmptyNote>{t("noScenes")}</EmptyNote>
      ) : (
        <>
          <ul ref={scenesListRef} className="divide-y divide-border">
            {scenes.map((scene) => (
              <li key={scene.index} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-[family-name:var(--font-reading)] text-[15px] font-semibold text-foreground">
                    {[scene.time, scene.location].filter(Boolean).join(" · ") ||
                      t("sceneUntitled", { n: scene.index + 1 })}
                  </p>
                  <SceneConfidenceBadge confidence={scene.confidence} />
                </div>
                {scene.actors.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-foreground/70">
                    {scene.actors.join(", ")}
                  </p>
                )}
                <p className="mt-2 text-[13px] leading-6 text-foreground">
                  {scene.action}
                </p>
                {scene.dialogue.length > 0 && (
                  <dl className="mt-2 grid grid-cols-[minmax(0,auto)_1fr] gap-x-3 gap-y-1 border-l-2 border-border pl-3 text-[12px] leading-5">
                    {scene.dialogue.map((d, i) => (
                      <Fragment key={i}>
                        <dt className="font-semibold text-foreground">{d.actor}</dt>
                        <dd className="text-foreground/70">{d.line}</dd>
                      </Fragment>
                    ))}
                  </dl>
                )}
                <p className="mt-2 text-[11px] text-foreground/70">
                  {t("sourcesVerifiedCount", { n: scene.sourceRefs.length })}
                </p>
                {scene.unresolved.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {scene.unresolved.map((u, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-1.5 text-[11px] leading-4 text-riskmed"
                      >
                        <AlertTriangle
                          className="mt-0.5 h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {u}{" "}
                          <span className="text-foreground/70">
                            ({t("addedAsWeakness")})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const EVENT_STATUS_TONE: Record<ReconstructionEventStatus, "success" | "danger" | "neutral"> = {
  // DISPUTED is danger (red), not the mock's amber "riskmed": once an unconfirmed-but-uncontested
  // claim is UNVERIFIED (see docs/adr/0002 on the backend), DISPUTED is reserved for an actual
  // conflict in the record — that's a red flag, not a medium risk. UNVERIFIED is neutral, not a
  // warning tone: it's silence in the record, not something alarming.
  VERIFIED: "success",
  DISPUTED: "danger",
  UNVERIFIED: "neutral",
}
const EVENT_STATUS_LABEL_KEY: Record<ReconstructionEventStatus, string> = {
  VERIFIED: "eventStatusVerified",
  DISPUTED: "eventStatusDisputed",
  UNVERIFIED: "eventStatusUnverified",
}
const EVENT_STATUS_BAR_CLASS: Record<ReconstructionEventStatus, string> = {
  VERIFIED: "bg-ok",
  DISPUTED: "bg-danger",
  UNVERIFIED: "bg-muted-foreground/40",
}
const EVENT_STATUS_TEXT_CLASS: Record<ReconstructionEventStatus, string> = {
  VERIFIED: "text-ok",
  DISPUTED: "text-danger",
  UNVERIFIED: "text-foreground",
}
// Fixed order everywhere a status appears as a set (bar segments, count legend) — never the
// order events happen to come back in, so the legend doesn't reshuffle between renders.
const EVENT_STATUS_ORDER: ReconstructionEventStatus[] = ["VERIFIED", "DISPUTED", "UNVERIFIED"]

const EVENT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// event.date is a plain YYYY-MM-DD (or null) — deliberately not routed through `new Date(...)` and
// toLocaleDateString: a date-only ISO string parses as UTC midnight, which a negative-UTC-offset
// browser then displays as the previous day. Formatting the parts directly sidesteps that.
function formatEventDate(date: string | null): string | null {
  if (!date) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  const month = EVENT_MONTHS[Number(m[2]) - 1]
  return month ? `${Number(m[3])} ${month} ${m[1]}` : date
}

function EventStatusBadge({ status }: { status: ReconstructionEventStatus }) {
  const { t } = useTranslation("terminal")
  return <Badge tone={EVENT_STATUS_TONE[status]}>{t(EVENT_STATUS_LABEL_KEY[status])}</Badge>
}

function EventRow({
  event,
  docNameById,
}: {
  event: ReconstructionEvent
  docNameById: Map<string, string>
}) {
  const { t } = useTranslation("terminal")
  const dateLabel = formatEventDate(event.date)
  const docName = event.sourceRef ? (docNameById.get(event.sourceRef.docId) ?? t("archivedDocument")) : null
  const otherDocs = (ids: string[]) =>
    ids.map((id, i) => (
      <Fragment key={id}>
        {i > 0 ? ", " : null}
        <DocumentLink docId={id}>{docNameById.get(id) ?? t("archivedDocument")}</DocumentLink>
      </Fragment>
    ))

  return (
    <li className="relative border-l border-border pb-5 pl-4 last:border-transparent last:pb-0">
      <span
        aria-hidden="true"
        className={`absolute top-1.5 -left-[4.5px] h-2 w-2 rounded-full ring-2 ring-card ${
          event.status ? EVENT_STATUS_BAR_CLASS[event.status] : "bg-muted-foreground/40"
        }`}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {dateLabel && <p className="text-[11px] font-medium text-foreground/70 tabular-nums">{dateLabel}</p>}
          <p className="font-[family-name:var(--font-reading)] text-[15px] leading-6 font-semibold text-foreground">{event.proposition}</p>
          {event.assertedBy && (
            <p className="mt-0.5 text-[11px] text-foreground/70 italic">{event.assertedBy}</p>
          )}
        </div>
        {event.status && <EventStatusBadge status={event.status} />}
      </div>

      {event.sourceRef && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-foreground/70">
          <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate" title={docName ?? undefined}>
            <DocumentLink docId={event.sourceRef.docId}>{docName}</DocumentLink>
          </span>
          {event.sourceRef.page != null && <span className="shrink-0">· p.{event.sourceRef.page}</span>}
        </p>
      )}
      {event.sourceRef?.quote && (
        <blockquote className="mt-1 flex items-start gap-1 border-l-2 border-border pl-2 text-[11px] text-foreground/70 italic">
          <Quote className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          {event.sourceRef.quote}
        </blockquote>
      )}

      {event.statusNote && <p className="mt-1.5 text-[11px] leading-4 text-foreground/70">{event.statusNote}</p>}
      {(event.corroboratedBy?.length || event.contradictedBy?.length) && (
        <p className="mt-1 text-[10px] text-foreground/70">
          {event.corroboratedBy?.length ? (
            <>
              {t("eventCorroboratedBy")} <span className="text-ok">{otherDocs(event.corroboratedBy)}</span>
            </>
          ) : null}
          {event.corroboratedBy?.length && event.contradictedBy?.length ? " · " : null}
          {event.contradictedBy?.length ? (
            <>
              {t("eventContradictedBy")} <span className="text-danger">{otherDocs(event.contradictedBy)}</span>
            </>
          ) : null}
        </p>
      )}
    </li>
  )
}

function EventsView({
  caseId,
  reconstructionEvents,
  documents,
}: {
  caseId: string
  reconstructionEvents: ReconstructionEvents | null
  documents: CaseSnapshot["documents"]
}) {
  const { t } = useTranslation("terminal")
  const events = reconstructionEvents?.events ?? null
  const docNameById = new Map(documents.map((d) => [d.id, d.name]))

  const generateEvents = useGenerateReconstructionEventsMutation(caseId)
  const eventsJob = useAiJobStatus(caseId, "caseReconstructionEvents")
  const isGenerating = generateEvents.isPending || eventsJob.data?.status === "IN_PROGRESS"

  // The 422's structured blockers (see ReconstructionEventBlocker) — what to upload or wait for,
  // read straight off the thrown error's body rather than re-parsing its message string.
  const blockers = (generateEvents.error as (Error & { body?: { blockers?: ReconstructionEventBlocker[] } }) | null)
    ?.body?.blockers

  const rowsRef = useRef<HTMLUListElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  useGSAP(
    () => {
      if (!generateEvents.isSuccess || reducedMotion) return
      const rows = rowsRef.current?.children
      if (rows?.length) gsap.from(rows, { opacity: 0, y: 8, duration: 0.3, stagger: 0.04, ease: "power2.out" })
    },
    { dependencies: [generateEvents.isSuccess, reducedMotion] },
  )

  const counts = new Map<ReconstructionEventStatus, number>()
  for (const e of events ?? []) {
    if (!e.status) continue
    counts.set(e.status, (counts.get(e.status) ?? 0) + 1)
  }
  const total = events?.length ?? 0
  const verifiedPct = total ? Math.round(((counts.get("VERIFIED") ?? 0) / total) * 100) : 0
  const present = EVENT_STATUS_ORDER.filter((s) => counts.get(s))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>{t("eventsLabel")}</SectionLabel>
        <button
          type="button"
          onClick={() => generateEvents.mutate()}
          disabled={isGenerating}
          className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {isGenerating ? t("generating") : events?.length ? t("regenerateEvents") : t("generateEvents")}
        </button>
      </div>

      {blockers?.length ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2.5">
          <p className="text-[12px] text-foreground">{t("eventsBlockedIntro")}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-4 text-foreground/70">
            {blockers.map((b, i) => (
              <li key={i}>
                {b.problem} {b.action}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <MutationError show={generateEvents.isError || (!isGenerating && eventsJob.data?.status === "FAILED")} />
      )}

      {!events || events.length === 0 ? (
        isGenerating ? <RowSkeletons /> : <EmptyNote>{t("noEvents")}</EmptyNote>
      ) : (
        <>
          <div title={t("eventsVerifiedOfTotal", { verified: counts.get("VERIFIED") ?? 0, total })}>
            <p className="text-[12px] text-foreground/70">
              <span className="font-semibold text-foreground">{verifiedPct}%</span>{" "}
              {t("eventStatusVerified").toLowerCase()}
              {present.map((s) => (
                <span key={s} className="ml-3 whitespace-nowrap">
                  {t(EVENT_STATUS_LABEL_KEY[s])}{" "}
                  <span className={`font-semibold ${EVENT_STATUS_TEXT_CLASS[s]}`}>{counts.get(s)}</span>
                </span>
              ))}
            </p>
            <div className="mt-1.5 flex h-1 gap-px overflow-hidden rounded-full" aria-hidden="true">
              {present.map((s) => (
                <div key={s} className={EVENT_STATUS_BAR_CLASS[s]} style={{ flexGrow: counts.get(s) }} />
              ))}
            </div>
            <span className="sr-only">{t("eventsVerifiedOfTotal", { verified: counts.get("VERIFIED") ?? 0, total })}</span>
          </div>

          <ul ref={rowsRef} className="mt-1 ml-1">
            {events.map((event) => (
              <EventRow key={event.index} event={event} docNameById={docNameById} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function StoryboardView({
  reconstruction,
  documents,
}: {
  reconstruction: CaseSnapshot["reconstruction"]
  documents: CaseSnapshot["documents"]
}) {
  const { t } = useTranslation("terminal")
  const scenes = reconstruction?.scenes ?? null
  const docNameById = new Map(documents.map((d) => [d.id, d.name]))

  if (!scenes || scenes.length === 0) {
    return <EmptyNote>{t("noScenes")}</EmptyNote>
  }

  return (
    <ul className="divide-y divide-border">
      {scenes.map((scene) => (
        <li key={scene.index} className="py-3 first:pt-0">
          <p className="text-[13px] font-semibold text-foreground">
            {[scene.time, scene.location].filter(Boolean).join(" · ") ||
              t("sceneUntitled", { n: scene.index + 1 })}
          </p>
          {scene.sourceRefs.length === 0 ? (
            <EmptyNote>{t("noExhibitsForScene")}</EmptyNote>
          ) : (
            <ul className="mt-2 grid grid-cols-1 gap-2 @sm:grid-cols-2">
              {scene.sourceRefs.map((ref, i) => (
                <li
                  key={i}
                  className="rounded-md bg-muted px-2.5 py-2 text-[12px]"
                >
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate" title={docNameById.get(ref.docId) ?? t("archivedDocument")}>
                      <DocumentLink docId={ref.docId}>{docNameById.get(ref.docId) ?? t("archivedDocument")}</DocumentLink>
                    </span>
                    {ref.page != null && (
                      <span className="shrink-0 text-foreground/70">
                        · p.{ref.page}
                      </span>
                    )}
                  </p>
                  {ref.quote && (
                    <blockquote className="mt-1 flex items-start gap-1 border-l-2 border-border pl-2 text-foreground/70 italic">
                      <Quote
                        className="mt-0.5 h-2.5 w-2.5 shrink-0"
                        aria-hidden="true"
                      />
                      {ref.quote}
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
