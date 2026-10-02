"use client"

import { useState } from "react"
import { ArrowUpRight, Download, Pause, Play, Plus } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import type { RagStatus, SampleCase } from "@/lib/sample-case/data"
import { SAMPLE_TILES, type SampleTile } from "@/lib/sample-case/tours"
import { SeverityChip } from "@/components/sample-case/severity-chip"
import { useTourT } from "@/lib/tour/use-tour-t"

const RAG_SEVERITY: Record<RagStatus, "low" | "med" | "high"> = { indexed: "low", indexing: "med", failed: "high" }
const label = "text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground"
const panel = "flex min-h-0 min-w-0 flex-col rounded-2xl border border-border bg-background"
const panelHead = "flex items-center gap-2 border-b border-border px-3.5 py-3"

/** The sample case's Workspace: Sources | Chat | Studio, filled in and read-only. */
export function SampleWorkspace({
  data,
  openTile,
  onOpenTile,
  onReadOnly,
}: {
  data: SampleCase
  openTile: SampleTile | null
  onOpenTile: (tile: SampleTile) => void
  onReadOnly: () => void
}) {
  const { t } = useTourT()
  const docCount = data.documents.reduce((n, f) => n + f.files.length, 0)
  const indexed = data.documents.flatMap((f) => f.files).filter((f) => f.status === "indexed").length

  return (
    <div className="grid min-h-[560px] grid-cols-1 gap-3.5 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_340px]">
      <section data-sample-tour="sources" aria-label={t("sampleCase.sources", { count: docCount })} className={panel}>
        <div className={panelHead}>
          <span className={`${label} flex-1`}>{t("sampleCase.sources", { count: docCount })}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onReadOnly}
                aria-label={t("sampleCase.upload")}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-border hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("sampleCase.upload")}</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-col gap-1 overflow-auto px-3 py-3">
          {data.documents.map((folder) => (
            <div key={folder.folder} className="flex flex-col gap-0.5">
              <span className={`${label} mt-1.5 px-1`}>{folder.folder}</span>
              {folder.files.map((file) => (
                <label key={file.name} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-[12.5px] hover:bg-foreground/5">
                  <input type="checkbox" defaultChecked={file.status === "indexed"} className="accent-brand-gold" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <SeverityChip sev={RAG_SEVERITY[file.status]}>{t(`sampleCase.rag.${file.status}`)}</SeverityChip>
                </label>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section data-sample-tour="chat" aria-label={t("sampleCase.chatScoped", { count: indexed })} className={`${panel} min-h-[420px]`}>
        <div className={panelHead}>
          <span className={label}>{t("sampleCase.chatScoped", { count: indexed })}</span>
        </div>
        <div className="flex flex-1 flex-col gap-3.5 p-4">
          <div className="max-w-[80%] self-end rounded-2xl bg-foreground/[0.06] px-3.5 py-2.5 text-[13.5px]">{data.chat.question}</div>
          <p className="m-0 max-w-[68ch] text-[13.5px] leading-relaxed">
            {data.chat.answer.map((part, i) =>
              "cite" in part ? (
                <span key={i} className="mx-0.5 inline-flex items-center rounded-full border border-border px-2 align-[1px] text-[11px] whitespace-nowrap">
                  {part.cite}
                </span>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>
        </div>
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-4 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{t("sampleCase.askPlaceholder")}</span>
          <button
            type="button"
            onClick={onReadOnly}
            aria-label={t("sampleCase.send")}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section data-sample-tour="studio" aria-label={t("sampleCase.studio")} className={`${panel} md:col-span-2 xl:col-span-1`}>
        <div className={panelHead}>
          <span className={label}>{t("sampleCase.studio")}</span>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-auto px-3.5 py-3">
          <div data-sample-tour="tiles" className="grid grid-cols-2 gap-2">
            {SAMPLE_TILES.map((tile) => (
              <button
                key={tile}
                type="button"
                aria-pressed={openTile === tile}
                onClick={() => onOpenTile(tile)}
                className={`flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  openTile === tile ? "border-foreground" : "border-border"
                } ${tile === "brief" ? "col-span-2" : "min-h-[76px]"}`}
              >
                <span className="text-[12.5px] font-semibold">{t(`sampleCase.tiles.${tile}.name`)}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">{t(`sampleCase.tiles.${tile}.sub`)}</span>
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-col gap-2.5 border-t border-border pt-3">
            {openTile ? <TileOutput data={data} tile={openTile} onReadOnly={onReadOnly} /> : <p className="m-0 text-[12.5px] text-muted-foreground">{t("sampleCase.pickTile")}</p>}
          </div>
        </div>
      </section>
    </div>
  )
}

function TileOutput({ data, tile, onReadOnly }: { data: SampleCase; tile: SampleTile; onReadOnly: () => void }) {
  const { t } = useTourT()
  const [playing, setPlaying] = useState(false)
  const heading = "m-0 font-['Libre_Caslon_Text'] text-lg font-light"
  const th = "border-b border-border px-1.5 py-1.5 text-left text-[9.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground"
  const td = "border-b border-border/60 px-1.5 py-1.5 align-top"

  switch (tile) {
    case "audio":
      return (
        <>
          <h3 className={heading}>{t("sampleCase.tiles.audio.name")}</h3>
          <div className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? t("sampleCase.pause") : t("sampleCase.play")}
              className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
            >
              {playing ? <Pause className="size-4 fill-current" aria-hidden="true" /> : <Play className="size-4 fill-current" aria-hidden="true" />}
            </button>
            <div aria-hidden="true" className="flex h-7 min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
              {Array.from({ length: 48 }, (_, i) => (
                <i
                  key={i}
                  className={`min-w-0.5 flex-1 rounded-sm ${i < 14 ? "bg-brand-gold" : "bg-muted-foreground/50"}`}
                  style={{ height: `${18 + Math.round(Math.abs(Math.sin(i * 1.7)) * 80)}%` }}
                />
              ))}
            </div>
            <span className="font-mono text-[11px] tabular-nums">1:52 / 6:40</span>
          </div>
          <div className="flex flex-col gap-2 text-[12.5px] leading-normal">
            {data.audioScript.map(([host, line], i) => (
              <p key={i} className="m-0">
                <b className="mr-1.5 font-mono text-[10px] tracking-[0.5px]">{t("sampleCase.host", { host }).toUpperCase()}</b>
                {line}
              </p>
            ))}
          </div>
        </>
      )
    case "mindmap":
      return (
        <>
          <h3 className={heading}>{t("sampleCase.tiles.mindmap.name")}</h3>
          <span className="self-start rounded-full bg-foreground px-3 py-1 text-[12.5px] font-semibold text-background">{t("sampleCase.caseStrategy")}</span>
          {data.mindMap.map((b) => (
            <div key={b.branch} className="grid grid-cols-[110px_1fr] items-start gap-2 border-l border-border pl-3.5 text-[12.5px]">
              <b className="pt-0.5 font-semibold">{b.branch}</b>
              <div className="flex flex-wrap gap-1">
                {b.nodes.map((n) => (
                  <span key={n} className="rounded-full border border-border px-2 py-0.5 text-[11.5px]">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      )
    case "timeline":
      return (
        <>
          <h3 className={heading}>{t("sampleCase.timelineCount", { count: data.timeline.length })}</h3>
          <div className="flex flex-col">
            {data.timeline.map((e) => (
              <div key={e.date + e.event} className="grid grid-cols-[86px_1fr] gap-2.5 border-b border-border/60 py-1.5 text-[12.5px]">
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{e.date}</span>
                <span>
                  {e.event}
                  <small className="block text-[11px] text-muted-foreground">{t("sampleCase.fromSource", { source: e.source })}</small>
                </span>
              </div>
            ))}
          </div>
        </>
      )
    case "datatable":
      return (
        <>
          <h3 className={heading}>{t("sampleCase.dataTableCount", { count: data.dataTable.length })}</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className={th}>{t("sampleCase.colType")}</th>
                  <th className={th}>{t("sampleCase.colLabel")}</th>
                  <th className={th}>{t("sampleCase.colDetail")}</th>
                </tr>
              </thead>
              <tbody>
                {data.dataTable.map((r) => (
                  <tr key={r.label}>
                    <td className={td}>{r.type}</td>
                    <td className={td}>{r.label}</td>
                    <td className={td}>{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )
    case "decisions":
      return (
        <>
          <h3 className={heading}>{t("sampleCase.tiles.decisions.name")}</h3>
          {data.decisions.map((d) => (
            <div key={d.claim} className="flex items-start gap-2 text-[12.5px]">
              <SeverityChip sev={d.status === "Disputed" ? "med" : "low"}>{d.status}</SeverityChip>
              <span className="min-w-0 flex-1">
                {d.claim}
                <small className="block text-[11px] leading-snug text-muted-foreground">{d.why}</small>
              </span>
            </div>
          ))}
        </>
      )
    case "brief":
      return (
        <>
          <h3 className={heading}>{t("sampleCase.tiles.brief.name")}</h3>
          <dl className="m-0 flex flex-col gap-2.5 text-[12.5px]">
            {(
              [
                ["briefFacts", <p key="f" className="m-0">{data.brief.facts}</p>],
                ["briefIssues", <ul key="i" className="m-0 pl-4">{data.brief.issues.map((x) => <li key={x}>{x}</li>)}</ul>],
                ["briefArguments", <ul key="a" className="m-0 pl-4">{data.brief.arguments.map((x) => <li key={x}>{x}</li>)}</ul>],
                ["briefRelief", <p key="r" className="m-0">{data.brief.relief}</p>],
              ] as const
            ).map(([key, body]) => (
              <div key={key}>
                <dt className="text-[9.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">{t(`sampleCase.${key}`)}</dt>
                <dd className="m-0 mt-0.5">{body}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            {(["downloadPdf", "downloadWord"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={onReadOnly}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3.5 text-[10px] font-semibold uppercase tracking-[1px] hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Download className="size-3" aria-hidden="true" />
                {t(`sampleCase.${k}`)}
              </button>
            ))}
          </div>
        </>
      )
  }
}
