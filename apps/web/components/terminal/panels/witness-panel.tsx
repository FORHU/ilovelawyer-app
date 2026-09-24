import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Trash2 } from "lucide-react"
import { useCreateWitnessMutation, useDeleteWitnessMutation, useUpdateWitnessMutation } from "@/lib/terminal/mutations"
import type { WitnessStatus } from "@/lib/terminal/types"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, dangerIconBtnClass, fieldClass, labelTextClass, primaryBtnClass } from "@/components/terminal/panel-kit"

const STATUSES: WitnessStatus[] = ["READY", "ADVERSE", "OUTSTANDING"]
const STATUS_STYLE: Record<WitnessStatus, { text: string; badge: string; bar: string; label: string }> = {
  READY: { text: "text-emerald-500", badge: "border-emerald-500/50 bg-emerald-500/10 text-emerald-500", bar: "bg-emerald-500", label: "witnessReady" },
  ADVERSE: { text: "text-red-400", badge: "border-red-400/50 bg-red-400/10 text-red-400", bar: "bg-red-400", label: "witnessAdverse" },
  OUTSTANDING: { text: "text-amber-500", badge: "border-amber-500/50 bg-amber-500/10 text-amber-500", bar: "bg-amber-400", label: "witnessOutstanding" },
}

type WitnessData = {
  name: string
  role?: string | null
  summary?: string | null
  status?: WitnessStatus
  credibility?: number
  contact?: string | null
}

// Reads the graph-view projection (view_type=witnesses) instead of slicing CaseSnapshot, so a
// witness added/removed from any mounted panel refreshes this one via the shared query cache.
export function WitnessPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const create = useCreateWitnessMutation(caseId)
  const update = useUpdateWitnessMutation(caseId)
  const del = useDeleteWitnessMutation(caseId)
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [summary, setSummary] = useState("")
  const graphView = useGraphViewQuery(caseId, "witnesses")
  const witnesses = (graphView.data?.nodes ?? []).map((node) => ({
    node,
    w: node.data as WitnessData,
  }))

  const counts = { READY: 0, ADVERSE: 0, OUTSTANDING: 0 }
  witnesses.forEach(({ w }) => {
    counts[w.status ?? "OUTSTANDING"] += 1
  })
  const total = witnesses.length
  const readyPct = total ? Math.round((counts.READY / total) * 100) : 0
  const ringR = 15
  const ringC = 2 * Math.PI * ringR

  return (
    <PanelBody gap="4">
      <p className="text-[13px] text-muted-foreground">{t("witnessesIntro")}</p>
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
      <PanelRowList empty={<EmptyNote>{t("noWitnesses")}</EmptyNote>}>
        {witnesses.map(({ node, w }) => {
          const status = w.status ?? "OUTSTANDING"
          const credibility = w.credibility ?? 50
          const style = STATUS_STYLE[status]
          const nextStatus = STATUSES[(STATUSES.indexOf(status) + 1) % STATUSES.length]!
          const commitCredibility = (value: number) => {
            if (value !== credibility) update.mutate({ id: node.refId, credibility: value })
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
                  {credibility}
                </span>
              </div>
            </PanelRow>
          )
        })}
      </PanelRowList>
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
