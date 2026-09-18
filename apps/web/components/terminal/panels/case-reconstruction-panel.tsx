import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { AlertTriangle, FileText, Loader2, Pencil, Quote, Save, Sparkles, Volume2 } from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { Badge } from "@workspace/ui/components/badge"
import { usePrefersReducedMotion } from "@/lib/terminal/use-reduced-motion"
import AttributedMarkdown, { AttributedTextLegend } from "@/components/shared/attributed-text"
import {
  pollReconstructionAudio,
  terminalKeys,
  useAiJobStatus,
  useGenerateReconstructionAudioMutation,
  useGenerateReconstructionMutation,
  useGenerateReconstructionScenesMutation,
  useGenerateTableReadMutation,
  useUpdateReconstructionMutation,
} from "@/lib/terminal/mutations"
import type { UpdateReconstructionPayload } from "@/lib/terminal/mutations"
import type { CaseSnapshot, SceneDetail } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, SectionLabel, ghostBtnClass, primaryBtnClass } from "@/components/terminal/panel-kit"

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
} as const

export function CaseReconstructionPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const queryClient = useQueryClient()
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
  const [audioPolling, setAudioPolling] = useState(false)
  const [viewMode, setViewMode] = useState<
    "narrative" | "scenes" | "storyboard"
  >("narrative")

  const generate = useGenerateReconstructionMutation(caseId)
  const update = useUpdateReconstructionMutation(caseId)
  const generateAudio = useGenerateReconstructionAudioMutation(caseId)
  const generateJob = useAiJobStatus(caseId, "caseReconstruction")
  const isGenerating =
    generate.isPending || generateJob.data?.status === "IN_PROGRESS"

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
  useEffect(() => {
    if (!pendingDraftSyncRef.current) return
    pendingDraftSyncRef.current = false
    setDrafts({
      general: registerText(reconstruction, "general"),
      court: registerText(reconstruction, "court"),
      opposing: registerText(reconstruction, "opposing"),
    })
    setDirty({ general: false, court: false, opposing: false })
    setIsEditingGeneral(false)
  }, [reconstruction])

  // Polls a Polly async job while one is in flight — same "caller drives the loop" contract
  // as the Transcription feature's job polling, just scoped locally to this panel instead of
  // a cross-page store, since there's only ever one audio job per reconstruction.
  useEffect(() => {
    if (!audioPolling) return
    const interval = setInterval(() => {
      pollReconstructionAudio(caseId)
        .then((result) => {
          if (result.status === "IN_PROGRESS") return
          setAudioPolling(false)
          queryClient.invalidateQueries({
            queryKey: terminalKeys.snapshot(caseId),
          })
        })
        .catch(() => setAudioPolling(false))
    }, 3000)
    return () => clearInterval(interval)
  }, [audioPolling, caseId, queryClient])

  const activeDraft = drafts[activeRegister]
  const activeDirty = dirty[activeRegister]
  const activeText = registerText(reconstruction, activeRegister)

  return (
    <PanelBody gap="3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("reconstructionNarrative")}</SectionLabel>
        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={isGenerating}
          className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {isGenerating
            ? t("generating")
            : narrative
              ? t("regenerate")
              : t("generate")}
        </button>
      </div>
      <MutationError show={generate.isError} />

      <div className="flex gap-1 border-b border-border">
        {(["narrative", "scenes", "storyboard"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`px-2.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-colors ${
              viewMode === mode
                ? "border-b-2 border-brand-gold text-foreground"
                : "text-muted-foreground hover:text-foreground"
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

      {viewMode === "narrative" && (
        <>
          <div className="flex gap-1 border-b border-border">
            {(Object.keys(REGISTER_TAB_KEYS) as ReconstructionRegister[]).map(
              (register) => (
                <button
                  key={register}
                  type="button"
                  onClick={() => setActiveRegister(register)}
                  className={`px-2.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-colors ${
                    activeRegister === register
                      ? "border-b-2 border-brand-gold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(REGISTER_TAB_KEYS[register])}
                </button>
              )
            )}
          </div>

          {!narrative && !generate.isPending ? (
            <EmptyNote>{t("noReconstruction")}</EmptyNote>
          ) : activeRegister !== "general" && !activeText && !activeDirty ? (
            <EmptyNote>{t("registerNotGenerated")}</EmptyNote>
          ) : activeRegister === "general" && !isEditingGeneral ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                {reconstruction?.claims?.length ? (
                  <AttributedTextLegend />
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingGeneral(true)}
                  className={`inline-flex shrink-0 items-center gap-1.5 ${ghostBtnClass}`}
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  {t("edit")}
                </button>
              </div>
              <div className="flex-1 rounded-md border border-border bg-muted px-3 py-2.5">
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
              className={`inline-flex items-center gap-1.5 self-end ${primaryBtnClass}`}
            >
              {update.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-3 w-3" aria-hidden="true" />
              )}
              {update.isPending ? t("saving") : t("save")}
            </button>
          )}
          <MutationError show={update.isError} />

          {reconstruction && reconstruction.gaps.length > 0 && (
            <div>
              <SectionLabel>{t("reconstructionGaps")}</SectionLabel>
              <ul className="list-disc space-y-1 pl-4 text-[12px] leading-5 text-muted-foreground">
                {reconstruction.gaps.map((gap, index) => (
                  <li key={index}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {activeRegister === "general" && narrative && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>{t("audioNarration")}</SectionLabel>
                <button
                  type="button"
                  onClick={() =>
                    generateAudio.mutate(undefined, {
                      onSuccess: () => {
                        setAudioPolling(true)
                        queryClient.invalidateQueries({
                          queryKey: terminalKeys.snapshot(caseId),
                        })
                      },
                    })
                  }
                  disabled={generateAudio.isPending || audioPolling}
                  className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
                >
                  {generateAudio.isPending || audioPolling ? (
                    <Loader2
                      className="h-3 w-3 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Volume2 className="h-3 w-3" aria-hidden="true" />
                  )}
                  {generateAudio.isPending || audioPolling
                    ? t("generatingAudio")
                    : reconstruction?.audioFile?.fileUrl
                      ? t("regenerateAudio")
                      : t("generateAudio")}
                </button>
              </div>

              <MutationError show={generateAudio.isError} />
              {reconstruction?.audioFile?.fileUrl && (
                <audio
                  controls
                  src={reconstruction.audioFile.fileUrl}
                  className="h-8 w-full"
                />
              )}
              {reconstruction?.audioStaleAt && (
                <p className="text-[11px] text-muted-foreground">
                  {t("audioOutOfDate")}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </PanelBody>
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

  const generateTableRead = useGenerateTableReadMutation(caseId)
  const tableReadJob = useAiJobStatus(caseId, "caseReconstructionTableRead")
  const isGeneratingTableRead =
    generateTableRead.isPending || tableReadJob.data?.status === "IN_PROGRESS"

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
      <div className="flex items-center justify-between gap-2">
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
      <MutationError show={generateScenes.isError} />

      {!scenes || scenes.length === 0 ? (
        <EmptyNote>{t("noScenes")}</EmptyNote>
      ) : (
        <>
          <ul ref={scenesListRef} className="space-y-2">
            {scenes.map((scene) => (
              <li
                key={scene.index}
                className="rounded-md border border-border px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-[12px] font-semibold text-foreground">
                    {[scene.time, scene.location].filter(Boolean).join(" · ") ||
                      t("sceneUntitled", { n: scene.index + 1 })}
                  </p>
                  <SceneConfidenceBadge confidence={scene.confidence} />
                </div>
                {scene.actors.length > 0 && (
                  <p className="mt-1 text-[10px] tracking-wider text-muted-foreground uppercase">
                    {scene.actors.join(" · ")}
                  </p>
                )}
                <p className="mt-1.5 text-[12px] leading-4 text-foreground">
                  {scene.action}
                </p>
                {scene.dialogue.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {scene.dialogue.map((d, i) => (
                      <li
                        key={i}
                        className="text-[12px] leading-4 text-muted-foreground"
                      >
                        <span className="font-semibold text-foreground">
                          {d.actor}:{" "}
                        </span>
                        {d.line}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-[10px] text-muted-foreground">
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
                          <span className="text-muted-foreground">
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

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>{t("tableRead")}</SectionLabel>
              <button
                type="button"
                onClick={() => generateTableRead.mutate()}
                disabled={isGeneratingTableRead}
                className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
              >
                {isGeneratingTableRead ? (
                  <Loader2
                    className="h-3 w-3 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Volume2 className="h-3 w-3" aria-hidden="true" />
                )}
                {isGeneratingTableRead
                  ? t("generatingAudio")
                  : reconstruction?.tableReadFile?.fileUrl
                    ? t("regenerateTableRead")
                    : t("generateTableRead")}
              </button>
            </div>
            <MutationError show={generateTableRead.isError} />
            {reconstruction?.tableReadFile?.fileUrl ? (
              <audio
                controls
                src={reconstruction.tableReadFile.fileUrl}
                className="mt-2 h-8 w-full"
              />
            ) : (
              <EmptyNote>{t("noTableRead")}</EmptyNote>
            )}
            {reconstruction?.tableReadStaleAt && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {t("tableReadOutOfDate")}
              </p>
            )}
          </div>
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
    <ul className="space-y-3">
      {scenes.map((scene) => (
        <li
          key={scene.index}
          className="rounded-md border border-border px-3 py-2.5"
        >
          <p className="text-[12px] font-semibold text-foreground">
            {[scene.time, scene.location].filter(Boolean).join(" · ") ||
              t("sceneUntitled", { n: scene.index + 1 })}
          </p>
          {scene.sourceRefs.length === 0 ? (
            <EmptyNote>{t("noExhibitsForScene")}</EmptyNote>
          ) : (
            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {scene.sourceRefs.map((ref, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border bg-muted px-2.5 py-2 text-[12px]"
                >
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate" title={docNameById.get(ref.docId) ?? ref.docId}>
                      {docNameById.get(ref.docId) ?? ref.docId}
                    </span>
                    {ref.page != null && (
                      <span className="shrink-0 text-muted-foreground">
                        · p.{ref.page}
                      </span>
                    )}
                  </p>
                  {ref.quote && (
                    <blockquote className="mt-1 flex items-start gap-1 border-l-2 border-border pl-2 text-muted-foreground italic">
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
