"use client"

import type { CSSProperties, ReactNode } from "react"
import { SAMPLE_TILES } from "@/lib/sample-case/tours"
import { useTourT } from "@/lib/tour/use-tour-t"

// The preview is drawn, not a picture file, so it follows the theme, the tenant's law and the
// screen width by itself. Every size inside it is a multiple of --u, a slice of the preview's own
// width (container query units), so it scales as one piece, like an image would.
const u = (n: number) => `calc(var(--u) * ${n})`

type Layout = "wide" | "tall"
type Box = Pick<CSSProperties, "left" | "right" | "top" | "bottom" | "width">

/** Where each panel and its numbered marker sit, per layout: 16:9 from `sm` up, 4:5 below. */
const PLACES: Record<Layout, { cases: Box; studio: Box; consultation: Box; marks: [Box, Box, Box] }> = {
  wide: {
    cases: { left: "4%", top: "8%", width: "47%" },
    studio: { right: "4%", top: "13%", width: "44%" },
    consultation: { left: "13%", bottom: "6%", width: "46%" },
    marks: [{ left: "2.6%", top: "4.5%" }, { right: "2.6%", top: "9.5%" }, { left: "11%", bottom: "31%" }],
  },
  tall: {
    cases: { left: "6%", right: "6%", top: "5%" },
    studio: { left: "10%", right: "6%", top: "37%" },
    consultation: { left: "6%", right: "10%", bottom: "4%" },
    marks: [{ left: "3%", top: "2.5%" }, { right: "3%", top: "34%" }, { left: "3%", top: "70%" }],
  },
}

const WAVE = [30, 65, 45, 90, 55, 75, 40, 60, 85, 35, 70, 50, 80, 30, 60, 45, 70, 35, 55, 25]
const CAPTIONS = ["cases", "studio", "consultation"] as const

function Panel({ style, children }: { style: CSSProperties; children: ReactNode }) {
  return (
    <div
      className="absolute flex flex-col border border-border bg-background shadow-[0_1.6cqw_4cqw_-1.8cqw_rgba(0,0,0,0.3)]"
      style={{ padding: u(1.8), gap: u(1.1), borderRadius: u(1.1), ...style }}
    >
      {children}
    </div>
  )
}

function Mark({ n, style }: { n: number; style: CSSProperties }) {
  return (
    <span
      className="absolute z-10 flex items-center justify-center rounded-full bg-brand-gold font-['Libre_Caslon_Text'] text-brand-gold-foreground"
      style={{ width: u(3.2), height: u(3.2), fontSize: u(1.6), boxShadow: `0 0 0 ${u(0.6)} color-mix(in srgb, var(--brand-gold) 20%, transparent)`, ...style }}
    >
      {n}
    </span>
  )
}

function PanelHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-['Libre_Caslon_Text']" style={{ fontSize: u(1.9) }}>
        {title}
      </span>
      <span className="font-semibold uppercase text-muted-foreground" style={{ fontSize: u(0.95), letterSpacing: u(0.1) }}>
        {note}
      </span>
    </div>
  )
}

/** The picture itself: a case list, Studio playing an audio overview, and a cited answer. */
function Illustration({ layout }: { layout: Layout }) {
  const { t } = useTourT()
  const wide = layout === "wide"
  const place = PLACES[layout]
  const cases = t("newAccountPreview.sample.cases", { returnObjects: true }) as unknown as { name: string; meta: string }[]
  const citations = t("newAccountPreview.sample.citations", { returnObjects: true }) as unknown as string[]
  const tiles = wide ? SAMPLE_TILES : SAMPLE_TILES.filter((tile) => tile === "audio" || tile === "mindmap" || tile === "brief")
  const mini = "whitespace-nowrap rounded-full border font-semibold uppercase"
  const miniStyle = { fontSize: u(0.85), padding: `${u(0.5)} ${u(0.9)}`, letterSpacing: u(0.08) }

  return (
    <div style={{ containerType: "inline-size" }} className="w-full">
      <div
        aria-hidden="true"
        className={`relative w-full overflow-hidden border border-border bg-card text-foreground ${wide ? "aspect-video" : "aspect-[4/5]"}`}
        style={
          {
            "--u": wide ? "1cqw" : "2.2cqw",
            borderRadius: u(1.4),
            backgroundImage: "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 1.4px)",
            backgroundSize: `${u(2.2)} ${u(2.2)}`,
          } as CSSProperties
        }
      >
        <Mark n={1} style={place.marks[0]} />
        <Panel style={place.cases}>
          <PanelHead title={t("newAccountPreview.sample.casesTitle")} note={t("newAccountPreview.sample.activeCount")} />
          {cases.slice(0, wide ? 3 : 2).map((c, i) => (
            <div key={c.name} className="grid grid-cols-[1fr_auto_auto] items-center border-t border-border" style={{ gap: u(0.8), paddingBlock: u(1) }}>
              <div className="min-w-0">
                <div className="truncate font-medium" style={{ fontSize: u(1.35) }}>
                  {c.name}
                </div>
                <div className="truncate text-muted-foreground" style={{ fontSize: u(1) }}>
                  {c.meta}
                </div>
              </div>
              <span className={`${mini} ${i === 0 ? "border-foreground" : "border-border"}`} style={miniStyle}>
                {t("sampleCase.tabWorkspace")}
              </span>
              <span className={`${mini} border-border`} style={miniStyle}>
                {t("sampleCase.tabTerminal")}
              </span>
            </div>
          ))}
        </Panel>

        <Mark n={2} style={place.marks[1]} />
        <Panel style={{ ...place.studio, zIndex: 2 }}>
          <PanelHead title={t("sampleCase.studio")} note={t("newAccountPreview.sample.sources")} />
          <div className="flex items-center rounded-full border border-border" style={{ gap: u(1), padding: `${u(0.7)} ${u(1.1)} ${u(0.7)} ${u(0.7)}` }}>
            <span className="relative shrink-0 rounded-full bg-brand-gold" style={{ width: u(2.6), height: u(2.6) }}>
              <span
                className="absolute"
                style={{
                  left: u(1),
                  top: u(0.75),
                  borderLeft: `${u(0.9)} solid var(--brand-gold-foreground)`,
                  borderTop: `${u(0.55)} solid transparent`,
                  borderBottom: `${u(0.55)} solid transparent`,
                }}
              />
            </span>
            <span className="flex flex-1 items-center" style={{ height: u(2.2), gap: u(0.25) }}>
              {WAVE.slice(0, wide ? 20 : 10).map((h, i) => (
                <i key={i} className={`flex-1 rounded-[1px] ${i < (wide ? 8 : 4) ? "bg-brand-gold" : "bg-muted-foreground/50"}`} style={{ height: `${h}%` }} />
              ))}
            </span>
            <span className="font-mono text-muted-foreground" style={{ fontSize: u(0.9) }}>
              {wide ? "04:12 / 11:30" : "04:12"}
            </span>
          </div>
          <div className="grid grid-cols-3" style={{ gap: u(0.9) }}>
            {tiles.map((tile) => (
              <div
                key={tile}
                className={`flex flex-col border ${tile === "audio" ? "border-brand-gold bg-brand-gold/[0.07]" : "border-border"}`}
                style={{ padding: u(1), gap: u(0.4), minHeight: u(wide ? 5.6 : 5), borderRadius: u(0.8) }}
              >
                <span className="font-semibold leading-tight" style={{ fontSize: u(1.1) }}>
                  {t(`sampleCase.tiles.${tile}.name`)}
                </span>
                {wide && (
                  <span className="leading-tight text-muted-foreground" style={{ fontSize: u(0.9) }}>
                    {t(`sampleCase.tiles.${tile}.sub`)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Mark n={3} style={place.marks[2]} />
        <Panel style={{ ...place.consultation, zIndex: 3 }}>
          <span className="max-w-[85%] self-end bg-foreground/[0.06]" style={{ fontSize: u(1.2), padding: `${u(0.9)} ${u(1.3)}`, borderRadius: u(1.2) }}>
            {t("newAccountPreview.sample.question")}
          </span>
          {wide && (
            <span className="leading-normal" style={{ fontSize: u(1.2) }}>
              {t("newAccountPreview.sample.answer")}
            </span>
          )}
          <div className="flex flex-wrap" style={{ gap: u(0.6) }}>
            {citations.slice(0, wide ? 3 : 2).map((c) => (
              <span
                key={c}
                className="border border-brand-gold/45 font-mono text-brand-gold"
                style={{ fontSize: u(0.9), padding: `${u(0.5)} ${u(0.8)}`, borderRadius: u(0.5) }}
              >
                {c}
              </span>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

/** What a filled-in account looks like, beside the Cases page's empty state, for an account with
 * no cases and no consultations yet (see useIsNewAccount — the caller decides when to show it).
 * The page has its own "Create your first case", so this is the picture and its captions alone. */
export function NewAccountPreview({ className = "" }: { className?: string }) {
  const { t } = useTourT()

  return (
    <figure className={`m-0 flex w-full flex-col gap-4 ${className}`}>
      <div role="img" aria-label={t("newAccountPreview.alt")}>
        <div className="hidden sm:block">
          <Illustration layout="wide" />
        </div>
        <div className="mx-auto w-full max-w-[360px] sm:hidden">
          <Illustration layout="tall" />
        </div>
      </div>
      <figcaption>
        <ol className="grid gap-3">
          {CAPTIONS.map((key, i) => (
            <li key={key} className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-[12.5px] leading-normal text-muted-foreground">
              <span
                aria-hidden="true"
                className="row-span-2 flex size-5 items-center justify-center rounded-full bg-brand-gold font-['Libre_Caslon_Text'] text-[11px] text-brand-gold-foreground"
              >
                {i + 1}
              </span>
              <span className="text-[13px] font-semibold text-foreground">{t(`newAccountPreview.captions.${key}.title`)}</span>
              <span>{t(`newAccountPreview.captions.${key}.body`)}</span>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  )
}
