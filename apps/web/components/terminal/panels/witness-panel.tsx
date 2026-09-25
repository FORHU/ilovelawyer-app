import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Loader2, Sparkles, Trash2 } from "lucide-react"
import {
  useAiJobStatus,
  useCreateWitnessMutation,
  useDeleteWitnessMutation,
  useScoreWitnessesMutation,
  useUpdateWitnessMutation,
} from "@/lib/terminal/mutations"
import type { Witness, WitnessNeed, WitnessStatus } from "@/lib/terminal/types"
import { graphViewKeys, useGraphViewQuery } from "@/lib/graph-view/mutations"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, dangerIconBtnClass, fieldClass, ghostBtnClass, labelTextClass, primaryBtnClass } from "@/components/terminal/panel-kit"

const STATUSES: WitnessStatus[] = ["READY", "ADVERSE", "OUTSTANDING"]
const STATUS_STYLE: Record<WitnessStatus, { text: string; badge: string; bar: string; label: string }> = {
  READY: { text: "text-emerald-500", badge: "border-emerald-500/50 bg-emerald-500/10 text-emerald-500", bar: "bg-emerald-500", label: "witnessReady" },
  ADVERSE: { text: "text-red-400", badge: "border-red-400/50 bg-red-400/10 text-red-400", bar: "bg-red-400", label: "witnessAdverse" },
  OUTSTANDING: { text: "text-amber-500", badge: "border-amber-500/50 bg-amber-500/10 text-amber-500", bar: "bg-amber-400", label: "witnessOutstanding" },
}

type WitnessData = Partial<Witness> & { name: string }

// Reads the graph-view projection (view_type=witnesses) instead of slicing CaseSnapshot, so a
// witness added/removed from any mounted panel refreshes this one via the shared query cache.
export function WitnessPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const queryClient = useQueryClient()
  const create = useCreateWitnessMutation(caseId)
  const update = useUpdateWitnessMutation(caseId)
  const del = useDeleteWitnessMutation(caseId)
  const score = useScoreWitnessesMutation(caseId)
  const job = useAiJobStatus(caseId, "witnessScoring")
  // Runs on its own after documents finish extracting (no button) — see WitnessExtractSvc.
  const extractJob = useAiJobStatus(caseId, "witnessExtract")
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [summary, setSummary] = useState("")
  const [openReasons, setOpenReasons] = useState<Set<string>>(new Set())
  const [openQuotes, setOpenQuotes] = useState<Set<string>>(new Set())
  const graphView = useGraphViewQuery(caseId, "witnesses")
  const witnesses = (graphView.data?.nodes ?? []).map((node) => ({
    node,
    w: node.data as WitnessData,
  }))

  // useAiJobStatus only refreshes the snapshot when a job finishes; this panel reads the graph
  // view, so refresh that too on either job's IN_PROGRESS -> DONE transition.
  const isScoring = score.isPending || job.data?.status === "IN_PROGRESS"
  const isExtracting = extractJob.data?.status === "IN_PROGRESS"
  const prevJobStatus = useRef(job.data?.status)
  const prevExtractStatus = useRef(extractJob.data?.status)
  useEffect(() => {
    const scoreDone = prevJobStatus.current === "IN_PROGRESS" && job.data?.status === "DONE"
    const extractDone = prevExtractStatus.current === "IN_PROGRESS" && extractJob.data?.status === "DONE"
    if (scoreDone || extractDone) {
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    }
    prevJobStatus.current = job.data?.status
    prevExtractStatus.current = extractJob.data?.status
  }, [job.data?.status, extractJob.data?.status, caseId, queryClient])

  const counts = { READY: 0, ADVERSE: 0, OUTSTANDING: 0 }
  witnesses.forEach(({ w }) => {
    counts[w.status ?? "OUTSTANDING"] += 1
  })
  const total = witnesses.length
  const readyPct = total ? Math.round((counts.READY / total) * 100) : 0
  const ringR = 15
  const ringC = 2 * Math.PI * ringR

  const toggleIn = (setter: typeof setOpenReasons) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleReasons = toggleIn(setOpenReasons)
  const toggleQuote = toggleIn(setOpenQuotes)

  return (
    <PanelBody gap="4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{t("witnessesIntro")}</p>
          {isExtracting ? (
            <p className={`mt-1 inline-flex items-center gap-1.5 ${labelTextClass}`}>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t("witnessExtracting")}
            </p>
          ) : null}
        </div>
        {total > 0 ? (
          <button
            type="button"
            onClick={() => score.mutate()}
            disabled={isScoring}
            className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
          >
            {isScoring ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3 w-3" aria-hidden="true" />
            )}
            {isScoring
              ? t("witnessScoring")
              : witnesses.some(({ w }) => w.scoredAt)
                ? t("witnessRescore")
                : t("witnessScore")}
          </button>
        ) : null}
      </div>
      <MutationError show={score.isError || job.data?.status === "FAILED"}>
        {job.data?.status === "FAILED" && !score.isError ? t("witnessScoreFailed") : undefined}
      </MutationError>
      {total > 0 ? (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r={ringR} fill="none" strokeWidth="3" className="stroke-border" />
              <circle
                cx="18"
                cy="18"
                r={ringR}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                className="stroke-emerald-500"
                strokeDasharray={`${(readyPct / 100) * ringC} ${ringC}`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
              {readyPct}%
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex h-1.5 gap-px overflow-hidden rounded-full">
              {STATUSES.map((s) =>
                counts[s] ? (
                  <div key={s} className={STATUS_STYLE[s].bar} style={{ flexGrow: counts[s] }} />
                ) : null,
              )}
            </div>
            <div className={`mt-1.5 flex flex-wrap gap-x-3 ${labelTextClass}`}>
              {STATUSES.map((s) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-sm ${STATUS_STYLE[s].bar}`} />
                  {t(STATUS_STYLE[s].label)} <span className={STATUS_STYLE[s].text}>{counts[s]}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {/* PanelRowList's <ul> is overflow-hidden: as a direct flex child of the scrolling PanelBody it
          would shrink to the pane height and clip rows instead of letting the body scroll. */}
      <div className="shrink-0">
        <PanelRowList empty={<EmptyNote>{t("noWitnesses")}</EmptyNote>}>
          {witnesses.map(({ node, w }) => {
            const status = w.status ?? "OUTSTANDING"
            const override = w.credibilityOverride ?? null
            const ai = w.aiCredibility ?? null
            // Manual override wins, then the AI score, then the legacy stored value.
            const credibility = override ?? ai ?? w.credibility ?? 50
            const hasScore = override !== null || ai !== null
            const scoredNoData = !hasScore && !!w.scoredAt
            const style = STATUS_STYLE[status]
            const nextStatus = STATUSES[(STATUSES.indexOf(status) + 1) % STATUSES.length]!
            const suggested = w.aiSuggestedStatus && w.aiSuggestedStatus !== status ? w.aiSuggestedStatus : null
            const reasons = w.aiRationale ?? []
            const reasonsOpen = openReasons.has(node.id)
            const quoteOpen = openQuotes.has(node.id)
            const aiFound = w.source === "AI"
            const done = new Set(w.needsDone ?? [])
            const needs: WitnessNeed[] = w.aiFactors?.needs ?? []
            const openNeeds = needs.filter((n) => !done.has(n.key))
            const toggleNeed = (key: string) => {
              const next = new Set(done)
              if (next.has(key)) next.delete(key)
              else next.add(key)
              update.mutate({ id: node.refId, needsDone: [...next] })
            }
            const band = w.aiFactors?.band ?? null
            const commitCredibility = (value: number) => {
              if (value !== credibility) update.mutate({ id: node.refId, credibilityOverride: value })
            }
            return (
              <PanelRow key={node.id} className="flex-col items-stretch gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">{w.name}</p>
                    {w.role || w.summary ? (
                      <p className={`mt-0.5 ${labelTextClass}`}>
                        {[w.role, w.summary].filter(Boolean).join(" — ")}
                      </p>
                    ) : null}
                    {w.contact ? <p className="mt-1 text-[13px] text-muted-foreground">{w.contact}</p> : null}
                    {aiFound ? (
                      <p className={`mt-1 ${labelTextClass}`}>
                        {w.sourceDocument
                          ? t("witnessFoundIn", { doc: w.sourceDocument.name })
                          : t("witnessFoundByAi")}
                        {w.sourceQuote ? (
                          <>
                            {" · "}
                            <button
                              type="button"
                              onClick={() => toggleQuote(node.id)}
                              aria-expanded={quoteOpen}
                              className="underline underline-offset-2 hover:text-foreground"
                            >
                              {t("witnessShowQuote")}
                            </button>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                    {aiFound && quoteOpen && w.sourceQuote ? (
                      <blockquote className="mt-1.5 border-l-2 border-border pl-2 text-[12px] italic text-foreground">
                        {w.sourceQuote}
                      </blockquote>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: node.refId, status: nextStatus })}
                    disabled={update.isPending}
                    title={t("witnessCycleStatus")}
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px] disabled:opacity-50 ${style.badge}`}
                  >
                    {t(style.label)}
                  </button>
                  <button
                    type="button"
                    onClick={() => del.mutate(node.refId)}
                    disabled={del.isPending}
                    className={dangerIconBtnClass}
                    aria-label={t("delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className="h-full overflow-hidden rounded-full"
                      style={{ width: `${credibility}%` }}
                    >
                      {/* Gradient is sized to the full track so the fill reveals red→amber→green by score. */}
                      <div
                        className="h-full"
                        style={{
                          width: credibility ? `${10000 / credibility}%` : "100%",
                          background: "linear-gradient(90deg, #f87171, #fbbf24 50%, #34d399)",
                        }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      defaultValue={credibility}
                      key={credibility}
                      aria-label={t("witnessCredibility")}
                      onPointerUp={(e) => commitCredibility(Number(e.currentTarget.value))}
                      onKeyUp={(e) => commitCredibility(Number(e.currentTarget.value))}
                      className="absolute inset-x-0 -top-1.5 h-4 w-full cursor-pointer opacity-0"
                    />
                  </div>
                  <span className={`w-6 text-right text-xs font-semibold tabular-nums ${style.text}`}>
                    {hasScore ? credibility : "—"}
                  </span>
                </div>
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${labelTextClass}`}>
                  <span>
                    {override !== null
                      ? t("witnessManualScore")
                      : ai !== null
                        ? t("witnessAiScore")
                        : scoredNoData
                          ? t("witnessNotEnoughData")
                          : t("witnessNotScored")}
                  </span>
                  {override !== null && ai !== null ? (
                    <button
                      type="button"
                      onClick={() => update.mutate({ id: node.refId, credibilityOverride: null })}
                      disabled={update.isPending}
                      className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                    >
                      {t("witnessResetToAi")} ({ai})
                    </button>
                  ) : null}
                  {reasons.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleReasons(node.id)}
                      aria-expanded={reasonsOpen}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {t("witnessWhy")}
                    </button>
                  ) : null}
                  {suggested ? (
                    <span className="inline-flex items-center gap-1.5">
                      {t("witnessAiSuggests", { status: t(STATUS_STYLE[suggested].label) })}
                      <button
                        type="button"
                        onClick={() => update.mutate({ id: node.refId, status: suggested })}
                        disabled={update.isPending}
                        className={`underline underline-offset-2 disabled:opacity-50 ${STATUS_STYLE[suggested].text}`}
                      >
                        {t("witnessApply")}
                      </button>
                    </span>
                  ) : null}
                </div>
                {reasonsOpen && reasons.length > 0 ? (
                  <ul className="flex flex-col gap-1.5 rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
                    {reasons.map((r, i) => (
                      <li key={i}>
                        {r.text}
                        {r.source ? <span className="text-muted-foreground"> — {r.source}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {needs.length > 0 ? (
                  <div className="rounded-md border border-border px-3 py-2">
                    <p className={labelTextClass}>
                      {t("witnessNeeds")}
                      {openNeeds.length > 0 ? ` · ${openNeeds.length}` : ""}
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1.5 text-[12px] text-foreground">
                      {needs.map((n) => (
                        <li key={n.key} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={done.has(n.key)}
                            onChange={() => toggleNeed(n.key)}
                            disabled={update.isPending}
                            aria-label={t("witnessNeedsDone")}
                            className="mt-0.5 shrink-0"
                          />
                          <span className={done.has(n.key) ? "text-muted-foreground line-through" : undefined}>
                            {n.text}
                            {n.link === "STATEMENT" && !w.statementReceived ? (
                              <>
                                {" "}
                                <button
                                  type="button"
                                  onClick={() => update.mutate({ id: node.refId, statementReceived: true })}
                                  disabled={update.isPending}
                                  className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                                >
                                  {t("witnessMarkReceived")}
                                </button>
                              </>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </PanelRow>
            )
          })}
        </PanelRowList>
      </div>
      <form
        className="mt-auto flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = name.trim()
          if (!value) return
          create.mutate({
            name: value,
            role: role.trim() || undefined,
            summary: summary.trim() || undefined,
          })
          setName("")
          setRole("")
          setSummary("")
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("witnessName")}
          aria-label={t("witnessName")}
          className={fieldClass}
        />
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={t("witnessSummary")}
          aria-label={t("witnessSummary")}
          className={fieldClass}
        />
        <div className="flex gap-2">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t("witnessRole")}
            aria-label={t("witnessRole")}
            className={`flex-1 ${fieldClass}`}
          />
          <button type="submit" disabled={create.isPending} className={primaryBtnClass}>
            {t("add")}
          </button>
        </div>
      </form>
      <MutationError show={create.isError || update.isError || del.isError} />
    </PanelBody>
  )
}
