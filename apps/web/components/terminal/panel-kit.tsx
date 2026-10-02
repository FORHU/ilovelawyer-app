import {
  Children,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"
import { ShieldCheck } from "lucide-react"
import gsap from "gsap"
import { Flip } from "gsap/Flip"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"
import type { PanelId } from "@/lib/terminal/types"
import { Badge } from "@workspace/ui/components/badge"

gsap.registerPlugin(Flip)

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

export const fieldClass =
  "h-8 min-w-0 rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
export const primaryBtnClass =
  "h-8 shrink-0 rounded-md bg-brand-gold px-3 text-[10px] font-semibold uppercase tracking-[1px] text-brand-navy-950 transition-colors hover:bg-brand-gold/85 disabled:opacity-50"
export const ghostBtnClass =
  "h-8 shrink-0 rounded-md border border-border bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
// The shared "delete this row" icon-button look — was duplicated byte-for-byte across 5 panels
// with a raw hover:text-red-500 before being pulled out here onto the semantic --danger token.
// Same shape as dangerIconBtnClass, with a neutral hover for a non-destructive action (edit).
export const editIconBtnClass =
  "shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground disabled:opacity-50"
export const dangerIconBtnClass =
  "shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-danger disabled:opacity-50"

// Inline failure feedback for a mutation — every panel's add/update/delete action should show
// this instead of letting a failed save look identical to a successful one. `children` overrides
// the generic message for mutations that have something more specific to say (e.g. upload
// failures); most call sites just pass `show={mutation.isError}` and take the default text.
export function MutationError({ show, children }: { show: boolean; children?: ReactNode }) {
  const { t } = useTranslation("terminal")
  if (!show) return null
  return <p className="text-[11px] text-danger">{children ?? t("genericSaveError")}</p>
}

// The 3 recurring text roles inside a panel body — every panel should pick one of these instead
// of hand-picking a bracket size (10/11/12/13px) or a bare text-xs/text-sm. See docs/adr/0013.
export const labelTextClass = "text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase"
export const bodyTextClass = "text-[13px] text-foreground"
export const secondaryTextClass = "text-[13px] text-muted-foreground"

// The design's five status tones, on the --danger/--riskmed/--warn/--ok tokens (globals.css).
// Every pill, mix bar, delta and row edge in a panel picks one of these instead of raw palette
// colors, so light/dark and the severity scale stay in one place.
export type Tone = "danger" | "riskmed" | "warn" | "ok" | "neutral"

export const TONE_STYLE: Record<Tone, { badge: string; bar: string; text: string; stroke: string; edge: string; tint: string }> = {
  danger: { badge: "border-danger/50 bg-danger/10 text-danger", bar: "bg-danger", text: "text-danger", stroke: "stroke-danger", edge: "border-l-danger", tint: "bg-danger/[0.06]" },
  riskmed: { badge: "border-riskmed/50 bg-riskmed/10 text-riskmed", bar: "bg-riskmed", text: "text-riskmed", stroke: "stroke-riskmed", edge: "border-l-riskmed", tint: "bg-riskmed/[0.05]" },
  warn: { badge: "border-warn/40 bg-warn/5 text-warn", bar: "bg-warn/70", text: "text-warn", stroke: "stroke-warn", edge: "border-l-warn/70", tint: "" },
  ok: { badge: "border-ok/50 bg-ok/10 text-ok", bar: "bg-ok", text: "text-ok", stroke: "stroke-ok", edge: "border-l-ok", tint: "" },
  neutral: { badge: "border-border bg-muted text-muted-foreground", bar: "bg-muted-foreground/40", text: "text-muted-foreground", stroke: "stroke-muted-foreground", edge: "border-l-border", tint: "" },
}

export function TonePill({ tone, title, children }: { tone: Tone; title?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px]",
        TONE_STYLE[tone].badge,
      )}
      title={title}
    >
      {children}
    </span>
  )
}

// The ▲ +4 / ▼ -1 / — 0 change marker. Which direction is bad depends on the panel: more impact
// is bad on Red Team and Weaknesses, good on Strengths. `children` trails the number (e.g. a "~"
// for an uncertain rating).
export function DeltaMark({
  value,
  badWhenUp,
  title,
  className,
  children,
}: {
  value: number
  badWhenUp: boolean
  title?: string
  className?: string
  children?: ReactNode
}) {
  const tone: Tone = value === 0 ? "neutral" : value > 0 === badWhenUp ? "danger" : "ok"
  return (
    <span className={cn("shrink-0 text-[11px] font-semibold tabular-nums", TONE_STYLE[tone].text, className)} title={title}>
      {value > 0 ? `▲ +${value}` : value < 0 ? `▼ ${value}` : "— 0"}
      {children}
    </span>
  )
}

export interface TagMixSegment {
  key: string
  label: string
  count: number
  tone: Tone
}

// The summary strip over a rated list: an optional ring (share handled, risk of loss, share in a
// favorable state — the caller says which) beside a stacked bar of how many rows carry each tag,
// with its legend. Segments with no rows are left out.
export function TagMixSummary({
  ring,
  segments,
  catalog,
}: {
  /** `label` names what the ring counts (e.g. "Closed") and sits under it — without it a bare
   * "0%" beside a full tag bar reads as a broken chart rather than "none closed yet". */
  ring?: { pct: number; tone: Tone; title: string; label?: string }
  segments: TagMixSegment[]
  /** The Terminal panel catalog's sizing — used by Legal Issues, Weaknesses, Strengths and the
   * Citation Map list. */
  catalog?: boolean
}) {
  const present = segments.filter((s) => s.count > 0)
  const ringR = catalog ? 16 : 15
  const ringC = 2 * Math.PI * ringR
  const box = catalog ? 40 : 36
  const stroke = catalog ? 4 : 3
  return (
    <div className="flex items-center gap-3">
      {ring ? (
        <div className="flex shrink-0 flex-col items-center gap-1" title={ring.title}>
          <div className="relative h-10 w-10">
            <svg viewBox={`0 0 ${box} ${box}`} className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx={box / 2} cy={box / 2} r={ringR} fill="none" strokeWidth={stroke} className={catalog ? "stroke-muted" : "stroke-border"} />
              {/* Skipped at 0%: a zero-length dash with a round linecap still paints a dot. */}
              {ring.pct > 0 && (
                <circle
                  cx={box / 2}
                  cy={box / 2}
                  r={ringR}
                  fill="none"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  className={TONE_STYLE[ring.tone].stroke}
                  strokeDasharray={`${(ring.pct / 100) * ringC} ${ringC}`}
                />
              )}
            </svg>
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center",
                ring.pct > 0 ? "text-foreground" : "text-muted-foreground",
                catalog ? "font-mono text-[9.5px] font-bold tabular-nums" : "text-[10px] font-semibold",
              )}
            >
              {ring.pct}%
            </span>
          </div>
          {ring.label ? (
            <span className="max-w-14 truncate font-mono text-[8.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground" aria-hidden="true">
              {ring.label}
            </span>
          ) : null}
          <span className="sr-only">{ring.title}</span>
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className={cn("flex h-1.5 overflow-hidden rounded-full", catalog ? "gap-[2px]" : "gap-px")}>
          {present.map((s) => (
            <div key={s.key} className={catalog ? CATALOG_BAR[s.tone] : TONE_STYLE[s.tone].bar} style={{ flexGrow: s.count }} />
          ))}
        </div>
        <div
          className={cn(
            "mt-1.5 flex flex-wrap",
            catalog ? "gap-x-2.5 gap-y-1 font-mono text-[9.5px] tracking-[0.4px] text-muted-foreground uppercase" : cn("gap-x-3", labelTextClass),
          )}
        >
          {present.map((s) => (
            <span key={s.key} className={cn("inline-flex items-center", catalog ? "gap-[5px]" : "gap-1")}>
              <span className={cn("h-1.5 w-1.5", catalog ? "rounded-[2px]" : "rounded-sm", catalog ? CATALOG_BAR[s.tone] : TONE_STYLE[s.tone].bar)} />
              {s.label} <span className={cn(TONE_STYLE[s.tone].text, catalog && "font-bold")}>{s.count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// The chip beside a row's title when Jev's check disagrees with it (unsupported premise,
// disputed burden, …). `title` says what Jev found.
export function JevFlag({ title }: { title: string }) {
  const { t } = useTranslation("terminal")
  return (
    <span
      className="rounded border border-warn/50 px-1 text-[9px] font-semibold uppercase tracking-[1px] text-warn"
      title={title}
    >
      {t("jevFlag")}
    </span>
  )
}

// "Checked by Jev: <verdict> (<pct>%)" in an expanded row, then the pilot's own detail lines as
// `children`, the uncertain note, and what the drafting model had rated it.
export function JevCheck({
  verdict,
  confidence,
  uncertain,
  modelRating,
  children,
}: {
  verdict: string
  confidence: number
  uncertain?: boolean
  modelRating?: string | null
  children?: ReactNode
}) {
  const { t } = useTranslation("terminal")
  return (
    <div className="flex flex-col gap-0.5 border-t border-border pt-1.5 text-muted-foreground">
      <p>
        <span className="text-foreground">{t("jevCheckedBy")}</span> {verdict} ({Math.round(confidence * 100)}%)
      </p>
      {children}
      {uncertain ? <p className="text-warn">{t("jevUncertain")}</p> : null}
      {modelRating ? <p>{modelRating}</p> : null}
    </div>
  )
}

// A form control with its visible label above it (never placeholder-as-label) and optional hint below.
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={labelTextClass}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

// For a row in a Jev-checked batch whose own check failed — says so instead of letting the
// model's rating pass as verified.
export function JevNotChecked() {
  const { t } = useTranslation("terminal")
  return <p className="text-warn">{t("jevNotChecked")}</p>
}

// ── LLM review ─────────────────────────────────────────────────────────────────────────────
// How Legal Issues, Weaknesses, Strengths and the Citation Map show the second model's check of
// a row: labelled "AI review", in plain words rather than scores — each point's exact confidence
// is on hover. The other panels keep JevCheck / JevFlag / JevNotChecked above.

export type Certainty = "sure" | "likely" | "possibly" | "unclear"

/** Bands match the checks' own cut-offs: 0.7 is the floor for a harsh verdict, 0.5 the
 * "uncertain" line. */
export function certaintyOf(confidence: number): Certainty {
  if (confidence >= 0.85) return "sure"
  if (confidence >= 0.7) return "likely"
  if (confidence >= 0.5) return "possibly"
  return "unclear"
}

/** One point of the review — stated plainly when the model was sure, otherwise followed by how
 * sure it was ("· likely"). */
export function ReviewPoint({ text, confidence, children }: { text: string; confidence: number; children?: ReactNode }) {
  const { t } = useTranslation("terminal")
  const certainty = certaintyOf(confidence)
  return (
    <li title={t("llmConfidence", { pct: Math.round(confidence * 100) })}>
      <span className="text-foreground">{text}</span>
      {certainty !== "sure" ? <span> · {t(`llmCertainty.${certainty}`)}</span> : null}
      {children}
    </li>
  )
}

export function LlmReview({
  uncertain,
  draftRating,
  children,
}: {
  uncertain?: boolean
  /** "AI draft said: Open" — when the review changed the drafting model's pill. */
  draftRating?: string | null
  children: ReactNode
}) {
  const { t } = useTranslation("terminal")
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-1.5 text-muted-foreground">
      <p className={cn("inline-flex items-center gap-1", labelTextClass)}>
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        {t("llmReview")}
      </p>
      <ul className="flex flex-col gap-0.5">{children}</ul>
      {uncertain ? <p className="text-warn">{t("llmUncertain")}</p> : null}
      {draftRating ? <p>{draftRating}</p> : null}
    </div>
  )
}

/** The chip beside a row's title when the LLM review disagrees with it; `title` says how. */
export function LlmFlag({ title }: { title: string }) {
  const { t } = useTranslation("terminal")
  return (
    <span
      className="rounded border border-warn/50 px-1 text-[9px] font-semibold uppercase tracking-[1px] text-warn"
      title={`${t("llmReview")}: ${title}`}
    >
      {t("llmFlag")}
    </span>
  )
}

/** For a row in a reviewed batch whose own review failed. */
export function LlmNotReviewed() {
  const { t } = useTranslation("terminal")
  return <p className="text-warn">{t("llmNotReviewed")}</p>
}

// ── Pane code chip ─────────────────────────────────────────────────────────────────────────
// The two-letter code before each pane's title, toned by what the pane is about — the catalog's
// codes where it names the pane; TL/ST/DC/TH/VF (neutral) for the panes it doesn't show.
const PANE_CODES: Record<PanelId, [string, Tone]> = {
  command: ["CS", "ok"],
  evidence: ["EV", "warn"],
  law: ["LW", "ok"],
  dates: ["TL", "neutral"],
  chat: ["AI", "warn"],
  mindMap: ["MP", "riskmed"],
  redTeam: ["RT", "danger"],
  procedure: ["ST", "neutral"],
  legalIssues: ["IS", "warn"],
  weaknesses: ["WK", "danger"],
  strengths: ["SG", "ok"],
  attackStrategy: ["AT", "riskmed"],
  defenseStrategy: ["DF", "ok"],
  witnesses: ["WT", "warn"],
  damages: ["DM", "ok"],
  caseReconstruction: ["RC", "neutral"],
  audioOverview: ["AU", "neutral"],
  decisions: ["DC", "neutral"],
  theories: ["TH", "neutral"],
}

export function PaneCode({ panelId }: { panelId: PanelId }) {
  const [code, tone] = PANE_CODES[panelId]
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-[19px] shrink-0 items-center rounded-[5px] border px-1.5 font-mono text-[9.5px] font-bold tracking-[0.6px]",
        tone === "neutral" ? "border-border bg-muted text-muted-foreground" : CATALOG_BADGE_BORDER[tone],
        TONE_STYLE[tone].text,
      )}
    >
      {code}
    </span>
  )
}

// ── The Terminal panel catalog's list look ─────────────────────────────────────────────────
// Legal Issues, Weaknesses, Strengths and the Citation Map list are built to the catalog design
// (11px muted intro, 12px row titles, 10px caps sub-lines, 17px pills) rather than the denser
// defaults the other panels use.
export const catalogBlurbClass = "text-[11px] leading-normal text-pretty text-muted-foreground"
export const catalogRowClass = "flex-col items-stretch gap-2 px-2.5 py-2"
export const catalogTitleClass = "text-[12px] text-pretty text-foreground"
export const catalogSubClass = "mt-0.5 block text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase"
export const catalogDeltaClass = "whitespace-nowrap font-mono text-[10px]"

// Solid segment colors, as the catalog draws its mix bar (TONE_STYLE's warn bar is softened).
const CATALOG_BAR: Record<Tone, string> = {
  danger: "bg-danger",
  riskmed: "bg-riskmed",
  warn: "bg-warn",
  ok: "bg-ok",
  neutral: "bg-muted-foreground/40",
}

const CATALOG_BADGE_TONE = { danger: "danger", riskmed: "warning", warn: "caution", ok: "success", neutral: "neutral" } as const
const CATALOG_BADGE_BORDER: Record<Tone, string> = {
  danger: "border-danger/40 bg-danger/10",
  riskmed: "border-riskmed/40 bg-riskmed/[0.12]",
  warn: "border-warn/40 bg-warn/10",
  ok: "border-ok/40 bg-ok/10",
  neutral: "border-border",
}

// The catalog's status pill: @workspace/ui's Badge (pill shape) at the design's size — 17px tall,
// 8.5px bold caps — with its 1px tone border.
export function CatalogPill({ tone, title, children }: { tone: Tone; title?: string; children: ReactNode }) {
  return (
    <Badge
      shape="pill"
      tone={CATALOG_BADGE_TONE[tone]}
      title={title}
      className={cn("h-[17px] border px-1.5 py-0 font-sans text-[8.5px] font-bold tracking-[1px]", CATALOG_BADGE_BORDER[tone])}
    >
      {children}
    </Badge>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className={cn("mb-2", labelTextClass)}>{children}</p>
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-muted px-3 py-4 text-center text-xs text-muted-foreground">
      {children}
    </p>
  )
}

// Shared "bordered list of rows" shape used across the mostly-flat panels (contradictions,
// witnesses, findings, damages, citations, audit log, risk register, deadlines) — one bordered
// container with a 1px divider between rows, instead of every row separately bordering itself.
//
// Also owns row enter/exit animation for every one of those panels, with no per-panel changes:
// callers just keep rendering `.map()` → `<PanelRow key={id}>` as before. React would normally
// unmount a removed row before any exit tween could play, so a removed key is kept rendered here
// (in `rendered`, tracked separately from the live `children`) until its own fade-out finishes;
// only then is it dropped, and Flip smooths the remaining rows into their new positions instead
// of letting them snap into the vacated space.
//
// The empty state lives here too (`empty` prop) rather than in each caller's own
// `items.length === 0 ? <EmptyNote/> : <PanelRowList>` branch — a parent-level branch like that
// unmounts this component the instant the source array hits 0, before the last row's own
// fade-out (above) ever gets to run. Keeping this component mounted and switching to `empty`
// only once `rendered` itself has drained (i.e. after the exit tween completes) lets the very
// last row animate out the same way row 2-of-5 does.
export function PanelRowList({
  children,
  empty,
  bare,
}: {
  children: ReactNode
  empty?: ReactNode
  /** Drop the bordered container and row dividers (Case Summary's risk register). */
  bare?: boolean
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<Record<string, unknown>>[]
  const keys = items.map((item) => String(item.key))
  const latestByKey = new Map(items.map((item) => [String(item.key), item]))
  const [rendered, setRendered] = useState(items)
  const prevKeysRef = useRef<string[]>(keys)
  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null)

  useLayoutEffect(() => {
    const prevKeys = prevKeysRef.current
    prevKeysRef.current = keys
    if (reducedMotion) {
      setRendered(items)
      return
    }
    const nextKeySet = new Set(keys)
    const removedKeys = prevKeys.filter((k) => !nextKeySet.has(k))
    const addedKeys = keys.filter((k) => !prevKeys.includes(k))

    if (removedKeys.length === 0) {
      setRendered(items)
      if (addedKeys.length > 0) {
        requestAnimationFrame(() => {
          const nodes = addedKeys
            .map((k) => listRef.current?.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(k)}"]`))
            .filter((el): el is HTMLElement => !!el)
          if (nodes.length) gsap.from(nodes, { opacity: 0, y: 6, duration: 0.25, stagger: 0.04, ease: "power2.out" })
        })
      }
      return
    }

    removedKeys.forEach((k) => {
      const node = listRef.current?.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(k)}"]`)
      if (!node) return
      gsap.to(node, {
        opacity: 0,
        duration: 0.18,
        ease: "power1.in",
        onComplete: () => {
          flipStateRef.current = listRef.current ? Flip.getState(listRef.current.children) : null
          setRendered((prev) => prev.filter((el) => String(el.key) !== k))
        },
      })
    })
    // items/keys are recomputed fresh from `children` every render — re-running this effect only
    // when the actual key composition changes (not on every render) is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join("|"), reducedMotion])

  useLayoutEffect(() => {
    if (!flipStateRef.current) return
    Flip.from(flipStateRef.current, { duration: 0.25, ease: "power1.inOut" })
    flipStateRef.current = null
  }, [rendered])

  if (rendered.length === 0) return <>{empty ?? null}</>

  // shrink-0: this list is usually a direct flex child of PanelBody's scrolling column, and an
  // overflow-hidden flex item's min-height resolves to 0 — without it the list shrinks to the pane
  // height and clips its rows instead of letting PanelBody scroll.
  return (
    <ul
      ref={listRef}
      className={bare ? "flex shrink-0 flex-col" : "shrink-0 overflow-hidden rounded-lg border border-border divide-y divide-border"}
    >
      {rendered.map((item) =>
        // `rendered` only re-syncs when the set of keys changes, so a row whose own content changed
        // (same key) would otherwise show its stale element. Prefer the live one; a removed row has
        // no live element and keeps its last copy for the exit fade-out.
        cloneElement(latestByKey.get(String(item.key)) ?? item, { "data-row-key": String(item.key) }),
      )}
    </ul>
  )
}

export function PanelRow({
  children,
  className,
  ...rest
}: {
  children: ReactNode
  className?: string
} & ComponentPropsWithoutRef<"li">) {
  return (
    <li className={cn("flex items-center gap-2.5 px-3 py-2.5", className)} {...rest}>
      {children}
    </li>
  )
}

// Shared root wrapper for every panel body. Density lives here in one place —
// see High Density Mode in CONTEXT.md / docs/adr/0013-legal-terminal-redesign.md —
// so a panel author never touches spacing tokens directly.
//
// gap="4" is the default for every panel. gap="3" is reserved for panels that are one long
// dense list with no sub-sections (Case Reconstruction, Red Team, Team Audit, Decisions) —
// tighter rhythm reads as a table there, not a form. There is no gap="5": no panel needs looser
// spacing than the default: extra separation between sections comes from a divider/heading.
const DENSE_GAP = { "3": "gap-1.5", "4": "gap-2.5" } as const
const NORMAL_GAP = { "3": "gap-3", "4": "gap-4" } as const

export function PanelBody({
  gap,
  children,
}: {
  gap: keyof typeof NORMAL_GAP
  children: ReactNode
}) {
  const dense = useTerminalDisplayStore((state) => state.highDensity)
  return (
    <div
      // Read by Free mode's "fit to content" resize (see fitPaneHeightToContent in
      // legal-terminal.tsx) — this is the one scrollable root every panel body shares, so its
      // scrollHeight is the panel's true natural content height regardless of its current size.
      data-panel-scroll
      className={`flex h-full min-h-0 flex-col ${dense ? DENSE_GAP[gap] : NORMAL_GAP[gap]} overflow-y-auto ${
        dense ? "p-2.5 text-[13px]" : "p-4 text-sm"
      } text-foreground`}
    >
      {children}
    </div>
  )
}

// The one place every arrangement mode (Free canvas, Columns, Tabs, Focus) builds pane chrome —
// was duplicated 4x by hand in legal-terminal.tsx before this, one copy per arrangement mode,
// each with its own flat `rounded-lg border` and no shadow (unlike the rest of the app's real
// `Card` primitive: rounded-2xl/shadow-md/ring-1 — see packages/ui/src/components/card.tsx).
//
// Structure is two nested elements occupying the identical bounding rect, not one, because a
// `box-shadow` on an `overflow-hidden` element gets clipped: the OUTER element owns
// position/size (passed in via `className`/`style` from the caller — unchanged from before),
// the border, ring, and shadow, with no overflow-hidden so a caller's resize handles (which
// anchor to it with negative-offset absolute positioning) keep working exactly as before. The
// INNER element sits at `absolute inset-0`, clips content to the same rounded corners, and holds
// the header + body — both of which can drop their own `rounded-t-*`/`rounded-b-*` classes since
// this inner clip already handles it.
export function Pane({
  className,
  style,
  pinned,
  panelId,
  flipId,
  header,
  children,
  resizeHandles,
  ...rest
}: {
  className?: string
  style?: CSSProperties
  pinned?: boolean
  panelId?: string
  flipId?: string
  header: ReactNode
  children: ReactNode
  resizeHandles?: ReactNode
} & Omit<ComponentPropsWithoutRef<"div">, "className" | "style" | "children">) {
  return (
    <div
      {...rest}
      data-panel-id={panelId}
      data-flip-id={flipId}
      className={cn(
        "rounded-2xl border bg-card shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10",
        pinned ? "border-brand-gold/60" : "border-border",
        className,
      )}
      style={style}
    >
      <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-2xl">
        {header}
        {children}
      </div>
      {resizeHandles}
    </div>
  )
}
