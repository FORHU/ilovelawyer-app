import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { FileText, Loader2, Sparkles, Trash2, Workflow } from "lucide-react"
import { CitationMap } from "@/components/citation-map"
import { citationMapKeys, useCitationMapQuery } from "@/lib/citation-map/mutations"
import type { AdverseCitationHit, CitationGround, CitationMapClaim, CitationMapSeedItem, CitationMapSweep } from "@/lib/citation-map/types"
import {
  useAdverseSweepMutation,
  useAiJobStatus,
  useDecideAdverseHitMutation,
  useCreateCitationGroundMutation,
  useCreateClaimMutation,
  useDeleteCitationGroundMutation,
  useDeleteClaimMutation,
  useExtractClaimsMutation,
  useMapCitationGroundsMutation,
  type AiGenerationKind,
} from "@/lib/terminal/mutations"
import { useAuthStore } from "@/lib/store/auth.store"
import {
  EmptyNote,
  JevCheck,
  JevFlag,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  SectionLabel,
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

type View = "list" | "graph"
type LinkState = "MAPPED" | "WEAK" | "NOT_APPLY" | "UNMAPPED"
const LINK_STYLE: Record<LinkState, { tone: Tone; label: string }> = {
  MAPPED: { tone: "ok", label: "groundMapped" },
  WEAK: { tone: "warn", label: "groundWeak" },
  NOT_APPLY: { tone: "danger", label: "groundDoesNotApply" },
  UNMAPPED: { tone: "neutral", label: "groundUnmapped" },
}

/** A link with no Jev read counts as Mapped — it's the model's or the lawyer's call, unchecked. */
function linkState(g: CitationGround): LinkState {
  if (g.jev?.attaches === "TANGENTIAL") return "WEAK"
  if (g.jev?.attaches === "DOES_NOT_APPLY") return "NOT_APPLY"
  return "MAPPED"
}

function authorityLabel(c: CitationMapSeedItem) {
  return c.resolved?.caseNumber || c.resolved?.title || c.citedReference || "—"
}

// The Terminal's Citation Map: a list of how each cited authority attaches to a pleaded claim
// (the design's view, the default), or the force graph of what each authority cites in turn.
// Both cover PH and UK only — same gate as the graph's own (components/citation-map/index.tsx).
export function CitationMapPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode)
  const [view, setView] = useState<View>("list")

  if (tenantCode !== "PH" && tenantCode !== "UK") return <CitationMap caseId={caseId} />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 justify-end gap-1 px-3 pt-2" role="tablist">
        {(["list", "graph"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[1px] transition-colors",
              view === v ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(v === "list" ? "citationMapList" : "citationMapGraph")}
          </button>
        ))}
      </div>
      {view === "list" ? (
        <div className="min-h-0 flex-1">
          <CitationGroundsList caseId={caseId} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 p-2">
          <CitationMap caseId={caseId} />
        </div>
      )}
    </div>
  )
}

type SweepOutcome = "PENDING" | "ADVERSE" | "CHECK" | "CLEAR"
const SWEEP_STYLE: Record<SweepOutcome, Tone> = { PENDING: "warn", ADVERSE: "danger", CHECK: "warn", CLEAR: "ok" }

/** ADVERSE when any hit is worth a Weakness (still open or accepted); CHECK when there are hits a
 * lawyer should still read (distinguished, or unchecked); CLEAR when there are none, or Jev read
 * every one as not touching the proposition. */
function sweepOutcome(sweep: CitationMapSweep): SweepOutcome {
  if (!sweep.sweptAt) return "PENDING"
  if (sweep.hits.some((h) => h.suggested && h.suggestionStatus !== "DISMISSED")) return "ADVERSE"
  if (sweep.hits.some((h) => h.suggestionStatus !== "DISMISSED" && h.jev?.effect !== "NOT_ADVERSE")) return "CHECK"
  return "CLEAR"
}

/** A queued job's button state, refreshing the seed when the job finishes (useAiJobStatus only
 * refreshes the snapshot). */
function useQueuedJob(caseId: string, kind: AiGenerationKind, pending: boolean) {
  const job = useAiJobStatus(caseId, kind)
  const queryClient = useQueryClient()
  const prev = useRef(job.data?.status)
  useEffect(() => {
    if (prev.current === "IN_PROGRESS" && job.data?.status === "DONE") {
      queryClient.invalidateQueries({ queryKey: citationMapKeys.seed(caseId) })
    }
    prev.current = job.data?.status
  }, [job.data?.status, caseId, queryClient])
  return { running: pending || job.data?.status === "IN_PROGRESS", failed: job.data?.status === "FAILED" }
}

function CitationGroundsList({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const seed = useCitationMapQuery(caseId)
  const extract = useExtractClaimsMutation(caseId)
  const map = useMapCitationGroundsMutation(caseId)
  const createGround = useCreateCitationGroundMutation(caseId)
  const deleteGround = useDeleteCitationGroundMutation(caseId)
  const extractJob = useQueuedJob(caseId, "claimExtract", extract.isPending)
  const mapJob = useQueuedJob(caseId, "citationGrounds", map.isPending)
  const sweepRun = useAdverseSweepMutation(caseId)
  const sweepJob = useQueuedJob(caseId, "adverseSweep", sweepRun.isPending)
  const decide = useDecideAdverseHitMutation(caseId)
  const [open, setOpen] = useState<string | null>(null)
  const [linkClaim, setLinkClaim] = useState("")
  const [linkRole, setLinkRole] = useState<"SUBSTANTIVE" | "PROCEDURAL">("SUBSTANTIVE")

  if (seed.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  const sweep = seed.data?.sweep ?? { sweptAt: null, authorities: 0, inCorpus: 0, hits: [] }
  const citations = seed.data?.citations ?? []
  const claims = seed.data?.claims ?? []
  const grounds = seed.data?.grounds ?? []
  const citationById = new Map(citations.map((c) => [c.id, c]))
  const claimById = new Map(claims.map((c) => [c.id, c]))
  const linked = grounds.filter((g) => citationById.has(g.citationCheckId) && claimById.has(g.claimId))
  const unmapped = citations.filter((c) => !linked.some((g) => g.citationCheckId === c.id))
  const mappedAuthorities = new Set(linked.filter((g) => linkState(g) === "MAPPED").map((g) => g.citationCheckId)).size
  const counts: Record<LinkState, number> = { MAPPED: 0, WEAK: 0, NOT_APPLY: 0, UNMAPPED: unmapped.length }
  linked.forEach((g) => (counts[linkState(g)] += 1))

  const toggle = (id: string) => {
    setOpen(open === id ? null : id)
    setLinkClaim("")
    setLinkRole("SUBSTANTIVE")
  }

  return (
    <PanelBody gap="4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">{t("groundsIntro")}</p>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => extract.mutate()}
            disabled={extractJob.running}
            className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
          >
            {extractJob.running ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3 w-3" aria-hidden="true" />}
            {extractJob.running ? t("groundsFindingClaims") : t("groundsFindClaims")}
          </button>
          <button
            type="button"
            onClick={() => map.mutate()}
            disabled={mapJob.running || claims.length === 0 || citations.length === 0}
            title={claims.length === 0 ? t("groundsNeedClaims") : citations.length === 0 ? t("groundsNoAuthorities") : undefined}
            className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
          >
            {mapJob.running ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Workflow className="h-3 w-3" aria-hidden="true" />}
            {mapJob.running ? t("groundsMapping") : t("groundsMap")}
          </button>
        </div>
      </div>
      <MutationError show={extract.isError || map.isError || extractJob.failed || mapJob.failed || seed.isError}>
        {extractJob.failed || mapJob.failed ? t("groundsJobFailed") : undefined}
      </MutationError>

      {citations.length > 1 ? (
        <TagMixSummary
          ring={{
            pct: Math.round((mappedAuthorities / citations.length) * 100),
            tone: "ok",
            title: t("groundsMappedCount", { done: mappedAuthorities, total: citations.length }),
          }}
          segments={(Object.keys(LINK_STYLE) as LinkState[]).map((s) => ({
            key: s,
            label: t(LINK_STYLE[s].label),
            count: counts[s],
            tone: LINK_STYLE[s].tone,
          }))}
        />
      ) : null}

      {/* Same shrink-0 wrapper as WitnessPanel: PanelRowList's <ul> is overflow-hidden. */}
      <div className="shrink-0">
        <PanelRowList empty={<EmptyNote>{t("groundsNoAuthorities")}</EmptyNote>}>
          {linked.map((g) => {
            const state = linkState(g)
            const isOpen = open === g.id
            return (
              <PanelRow key={g.id} className="flex-col items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                      {authorityLabel(citationById.get(g.citationCheckId)!)} → {claimById.get(g.claimId)!.title}
                      {state === "NOT_APPLY" ? <JevFlag title={t("groundJevFlag")} /> : null}
                    </span>
                    <span className={`mt-0.5 block ${labelTextClass}`}>
                      {t(`groundRole.${g.role}`)}
                      {g.source === "MANUAL" ? ` · ${t("groundAddedByYou")}` : null}
                    </span>
                  </span>
                  <TonePill tone={LINK_STYLE[state].tone}>{t(LINK_STYLE[state].label)}</TonePill>
                </button>
                {isOpen ? (
                  <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
                    {g.reason ? <p>{g.reason}</p> : null}
                    <p className="text-muted-foreground">“{citationById.get(g.citationCheckId)!.quotedText}”</p>
                    {g.jev ? <JevCheck verdict={t(`groundJev.${g.jev.attaches}`)} confidence={g.jev.confidence} /> : null}
                    <div className="flex justify-end border-t border-border pt-2">
                      <button
                        type="button"
                        onClick={() => deleteGround.mutate(g.id)}
                        disabled={deleteGround.isPending}
                        className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        {t("groundRemove")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </PanelRow>
            )
          })}
          {unmapped.map((c) => {
            const isOpen = open === c.id
            return (
              <PanelRow key={c.id} className="flex-col items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-foreground">{authorityLabel(c)}</span>
                    <span className={`mt-0.5 block ${labelTextClass}`}>{t("groundNotLinked")}</span>
                  </span>
                  <TonePill tone={LINK_STYLE.UNMAPPED.tone}>{t(LINK_STYLE.UNMAPPED.label)}</TonePill>
                </button>
                {isOpen ? (
                  <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
                    <p className="text-muted-foreground">“{c.quotedText}”</p>
                    {claims.length === 0 ? (
                      <p className="text-muted-foreground">{t("groundsNeedClaims")}</p>
                    ) : (
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (!linkClaim) return
                          createGround.mutate({ citationCheckId: c.id, claimId: linkClaim, role: linkRole })
                        }}
                      >
                        <select
                          value={linkClaim}
                          onChange={(e) => setLinkClaim(e.target.value)}
                          aria-label={t("groundPickClaim")}
                          className={`min-w-0 flex-1 ${fieldClass}`}
                        >
                          <option value="">{t("groundPickClaim")}</option>
                          {claims.map((claim) => (
                            <option key={claim.id} value={claim.id}>
                              {claim.title}
                            </option>
                          ))}
                        </select>
                        <select
                          value={linkRole}
                          onChange={(e) => setLinkRole(e.target.value as "SUBSTANTIVE" | "PROCEDURAL")}
                          aria-label={t("groundRoleLabel")}
                          className={`w-40 shrink-0 ${fieldClass}`}
                        >
                          <option value="SUBSTANTIVE">{t("groundRole.SUBSTANTIVE")}</option>
                          <option value="PROCEDURAL">{t("groundRole.PROCEDURAL")}</option>
                        </select>
                        <button type="submit" disabled={!linkClaim || createGround.isPending} className={primaryBtnClass}>
                          {t("groundLink")}
                        </button>
                      </form>
                    )}
                  </div>
                ) : null}
              </PanelRow>
            )
          })}
          {citations.length > 0 ? (
            <PanelRow key="sweep" className="flex-col items-stretch gap-2">
              <SweepRowBody
                sweep={sweep}
                running={sweepJob.running}
                isOpen={open === "sweep"}
                onToggle={() => toggle("sweep")}
                onRun={() => sweepRun.mutate()}
                onDecide={(id, decision) => decide.mutate({ id, decision })}
                deciding={decide.isPending}
                citationById={citationById}
              />
            </PanelRow>
          ) : null}
        </PanelRowList>
      </div>
      <MutationError show={createGround.isError || deleteGround.isError || sweepRun.isError || sweepJob.failed || decide.isError}>
        {sweepJob.failed ? t("groundsJobFailed") : undefined}
      </MutationError>

      <ClaimsSection caseId={caseId} claims={claims} />
    </PanelBody>
  )
}

// The last row of the list: the adverse-citation sweep — its outcome as a pill, and on expand what
// it found, with each hit worth a Weakness offered to the lawyer to add or dismiss.
function SweepRowBody({
  sweep,
  running,
  isOpen,
  onToggle,
  onRun,
  onDecide,
  deciding,
  citationById,
}: {
  sweep: CitationMapSweep
  running: boolean
  isOpen: boolean
  onToggle: () => void
  onRun: () => void
  onDecide: (id: string, decision: "accept" | "dismiss") => void
  deciding: boolean
  citationById: Map<string, CitationMapSeedItem>
}) {
  const { t } = useTranslation("terminal")
  const outcome = sweepOutcome(sweep)
  const adverse = sweep.hits.filter((h) => h.suggested && h.suggestionStatus !== "DISMISSED").length
  const pill = {
    PENDING: t("sweepPending"),
    ADVERSE: t("sweepAdverse", { n: adverse }),
    CHECK: t("sweepCheck"),
    CLEAR: t("sweepClear"),
  }[outcome]
  return (
    <>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-foreground">{t("sweepTitle")}</span>
          <span className={`mt-0.5 block ${labelTextClass}`}>
            {running
              ? t("sweepRunning")
              : sweep.sweptAt
                ? t("sweepSummary", {
                    date: new Date(sweep.sweptAt).toLocaleDateString(),
                    inCorpus: sweep.inCorpus,
                    total: sweep.authorities,
                  })
                : t("sweepNotRun")}
          </span>
        </span>
        {running ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
        <TonePill tone={SWEEP_STYLE[outcome]}>{pill}</TonePill>
      </button>
      {isOpen ? (
        <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
          <p className="text-muted-foreground">{t("sweepScope")}</p>
          {sweep.sweptAt && sweep.hits.length === 0 ? <p>{t("sweepNoHits")}</p> : null}
          {sweep.hits.map((hit) => (
            <SweepHit key={hit.id} hit={hit} citation={citationById.get(hit.citationCheckId)} onDecide={onDecide} deciding={deciding} />
          ))}
          <div className="flex justify-end border-t border-border pt-2">
            <button type="button" onClick={onRun} disabled={running} className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}>
              {running ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Workflow className="h-3 w-3" aria-hidden="true" />}
              {sweep.sweptAt ? t("sweepRerun") : t("sweepRun")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

function SweepHit({
  hit,
  citation,
  onDecide,
  deciding,
}: {
  hit: AdverseCitationHit
  citation: CitationMapSeedItem | undefined
  onDecide: (id: string, decision: "accept" | "dismiss") => void
  deciding: boolean
}) {
  const { t } = useTranslation("terminal")
  return (
    <div className={cn("flex flex-col gap-1 border-t border-border pt-2", hit.suggestionStatus === "DISMISSED" && "opacity-60")}>
      <p className="font-medium">
        {citation ? authorityLabel(citation) : "—"}
        <span className="font-normal text-muted-foreground">
          {" — "}
          {hit.kind === "OWN_STATUS"
            ? t("sweepOwnStatus")
            : t("sweepTreatment", { treatment: t(`sweepTreatmentWord.${hit.treatment}`), citing: hit.citingTitle ?? "—" })}
        </span>
      </p>
      {hit.excerpt ? <p className="text-muted-foreground">“{hit.excerpt}”</p> : null}
      {hit.jev ? <JevCheck verdict={t(`sweepJev.${hit.jev.effect}`)} confidence={hit.jev.confidence} /> : null}
      {hit.suggestionStatus === "ACCEPTED" ? (
        <p className="text-ok">{t("sweepAdded")}</p>
      ) : hit.suggestionStatus === "DISMISSED" ? (
        <p className="text-muted-foreground">{t("sweepDismissed")}</p>
      ) : hit.suggested ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => onDecide(hit.id, "accept")} disabled={deciding} className={primaryBtnClass}>
            {t("sweepAddWeakness")}
          </button>
          <button type="button" onClick={() => onDecide(hit.id, "dismiss")} disabled={deciding} className={ghostBtnClass}>
            {t("sweepDismiss")}
          </button>
        </div>
      ) : null}
    </div>
  )
}

// The pleaded claims the authorities attach to: found in the pleadings ("Find claims") or added
// by hand. Deleting a claim also removes its links (the API cascades).
function ClaimsSection({ caseId, claims }: { caseId: string; claims: CitationMapClaim[] }) {
  const { t } = useTranslation("terminal")
  const create = useCreateClaimMutation(caseId)
  const del = useDeleteClaimMutation(caseId)
  const [title, setTitle] = useState("")
  const [cause, setCause] = useState("")

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border pt-3">
      <SectionLabel>{t("claimsTitle", { n: claims.length })}</SectionLabel>
      <PanelRowList empty={<EmptyNote>{t("claimsEmpty")}</EmptyNote>}>
        {claims.map((claim) => (
          <PanelRow key={claim.id} className="items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-5 text-foreground">{claim.title}</p>
              {claim.causeOfAction ? <p className={labelTextClass}>{claim.causeOfAction}</p> : null}
              {claim.source === "AI" ? (
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-semibold tracking-[1px] text-brand-gold uppercase">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {t("aiGenerated")}
                  </span>
                  {claim.sourceLabel ? (
                    <span className="inline-flex min-w-0 items-center gap-1" title={claim.sourceQuote ?? undefined}>
                      <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{t("groundedIn", { doc: claim.sourceLabel })}</span>
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => del.mutate(claim.id)}
              disabled={del.isPending}
              className={dangerIconBtnClass}
              aria-label={t("delete")}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </PanelRow>
        ))}
      </PanelRowList>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = title.trim()
          if (!value) return
          create.mutate({ title: value, ...(cause.trim() ? { causeOfAction: cause.trim() } : {}) })
          setTitle("")
          setCause("")
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("claimTitlePlaceholder")}
          aria-label={t("claimTitlePlaceholder")}
          className={`min-w-0 flex-1 ${fieldClass}`}
        />
        <input
          value={cause}
          onChange={(e) => setCause(e.target.value)}
          placeholder={t("claimCausePlaceholder")}
          aria-label={t("claimCausePlaceholder")}
          className={`min-w-0 flex-1 ${fieldClass}`}
        />
        <button type="submit" disabled={create.isPending} className={primaryBtnClass}>
          {t("add")}
        </button>
      </form>
      <MutationError show={create.isError || del.isError} />
    </div>
  )
}
