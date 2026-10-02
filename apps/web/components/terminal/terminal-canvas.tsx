"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"
import {
  AppWindow,
  ArrowLeftRight,
  Grip,
  LayoutPanelLeft,
  Maximize2,
  Minimize2,
  Pin,
  Plus,
  X,
} from "lucide-react"
import { TerminalPanelBody } from "@/components/terminal/terminal-panels"
import { PaneActivityMark } from "@/components/terminal/pane-activity"
import { Pane, PaneCode } from "@/components/terminal/panel-kit"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import type { ArrangementValue, CaseSnapshot, PanelId, PanelLayout } from "@/lib/terminal/types"

// "dates" is permanently folded into Evidence & Timeline (TerminalPanelBody renders it as
// null) — redTeam is a real, addable panel now, not force-hidden the way it used to be.
// Single source of truth for the whole terminal (legal-terminal.tsx imports this rather than
// keeping its own copy) since cascadeRect below needs it too.
export const HIDDEN_PANELS = new Set<PanelId>(["dates"])

const MIN_FR = 0.18
const PANE_GAP_PX = 6
// 1/24 gives a 24-column/row grid — fine enough not to feel restrictive at
// MIN_FR-sized panes (~4.3 cells) but still a real snap, not a cosmetic one. Exported: legal-
// terminal.tsx's updateDragPreview (Columns/Tabs/Focus drag-preview) snaps to the same grid.
export const GRID_SNAP_STEP = 1 / 24
// Minimum width/height fraction a Columns-mode column or stacked pane can be resized down to —
// same neighbor-trade + floor model as the Free canvas's MIN_FR, just a separate constant since
// this grid's minimum can be roomier (fewer, larger panes than the freeform canvas).
const MIN_COLUMN_FR = 0.12
// Fraction nudged per arrow-key press on any resize divider/handle — the keyboard alternative
// to pointer-drag resize (WCAG 2.5.7). Deliberately coarser than GRID_SNAP_STEP (~0.042) so a
// keyboard user can reach a meaningfully different size in a handful of presses.
const RESIZE_KEY_STEP = 0.02
// What ModalOverlay below treats as a tab stop when trapping focus inside itself.
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Shared by every pointer-drag in this file (pane move/resize, column/stack/tab-split
// dividers): setPointerCapture alone doesn't stop the browser from starting a native text
// selection under the initial pointerdown (e.g. a header title), which then keeps extending
// as the pointer moves and makes the drag look like it's fighting itself. Module-scoped
// (not per-component) since body.style is global and only one drag runs at a time. Mirrors
// use-resizable-width.ts's cursor/selection lock.
let prevBodyUserSelect: string | null = null
function lockSelection() {
  if (prevBodyUserSelect !== null) return
  prevBodyUserSelect = document.body.style.userSelect
  document.body.style.userSelect = "none"
}
function unlockSelection() {
  if (prevBodyUserSelect === null) return
  document.body.style.userSelect = prevBodyUserSelect
  prevBodyUserSelect = null
}

export type PaneRect = { x: number; y: number; width: number; height: number }
export type ResizeEdge = { n?: boolean; s?: boolean; e?: boolean; w?: boolean }
type ResizeDrag = PaneRect & {
  panelId: PanelId
  edges: ResizeEdge
  startX: number
  startY: number
  lastDx?: number
  lastDy?: number
}
type MoveDrag = PaneRect & {
  panelId: PanelId
  startX: number
  startY: number
  armed: boolean
  lastDx?: number
  lastDy?: number
}
export type PaneDragPreview = PaneRect & { panelId: PanelId }

// Exported: legal-terminal.tsx's updateDragPreview (Columns/Tabs/Focus drag-preview) shares
// this same clamp/snap math.
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function snapValue(value: number, step: number): number {
  return Math.round(value / step) * step
}

function snapPosition(value: number, max: number, step: number): number {
  const clamped = clamp(value, 0, max)
  const snapped = snapValue(clamped, step)
  return Math.abs(max - snapped) < step / 2 ? max : clamp(snapped, 0, max)
}

function panelRect(panel: PanelLayout): PaneRect {
  return {
    x: Number.isFinite(panel.x) ? Number(panel.x) : 0,
    y: Number.isFinite(panel.y) ? Number(panel.y) : 0,
    width: Math.max(MIN_FR, panel.width || MIN_FR),
    height: Math.max(MIN_FR, panel.height || MIN_FR),
  }
}

function clampResize(drag: ResizeDrag, dx: number, dy: number, snap: boolean): PaneRect {
  const right = drag.x + drag.width
  const bottom = drag.y + drag.height
  let x = drag.x
  let y = drag.y
  let width = drag.width
  let height = drag.height

  if (drag.edges.w) {
    x = clamp(drag.x + dx, 0, right - MIN_FR)
    width = right - x
  } else if (drag.edges.e) {
    width = clamp(drag.width + dx, MIN_FR, 1 - drag.x)
  }

  if (drag.edges.n) {
    y = clamp(drag.y + dy, 0, bottom - MIN_FR)
    height = bottom - y
  } else if (drag.edges.s) {
    height = clamp(drag.height + dy, MIN_FR, 1 - drag.y)
  }

  // Snap after the normal clamp so the fixed (unmoved) edge stays exactly put —
  // re-clamping post-snap keeps the moved edge from crossing the fixed one.
  if (snap) {
    if (drag.edges.w) {
      x = clamp(snapValue(x, GRID_SNAP_STEP), 0, right - MIN_FR)
      width = right - x
    } else if (drag.edges.e) {
      width = clamp(snapValue(width, GRID_SNAP_STEP), MIN_FR, 1 - drag.x)
    }
    if (drag.edges.n) {
      y = clamp(snapValue(y, GRID_SNAP_STEP), 0, bottom - MIN_FR)
      height = bottom - y
    } else if (drag.edges.s) {
      height = clamp(snapValue(height, GRID_SNAP_STEP), MIN_FR, 1 - drag.y)
    }
  }

  return { x, y, width, height }
}

// Move is visualized live with a compositor-only `transform` (translate) instead of touching
// left/top (layout-triggering). React never renders a `transform` for a pane (it's outside the
// style object in the JSX), so nothing clears it except clearLiveMoveTransform, called once the
// drag ends and the real, committed left/top are patched into state.
function applyLiveMoveTransform(panelId: PanelId, dxPx: number, dyPx: number) {
  const el = document.querySelector<HTMLElement>(`[data-panel-id="${panelId}"]`)
  if (!el) return
  el.style.transform = `translate3d(${dxPx}px, ${dyPx}px, 0)`
}

function clearLiveMoveTransform(panelId: PanelId) {
  const el = document.querySelector<HTMLElement>(`[data-panel-id="${panelId}"]`)
  if (!el) return
  el.style.transform = ""
  el.style.willChange = ""
}

// Resize deliberately writes real left/top/width/height (not a transform) — a scale() experiment
// made content visibly stretch while dragging, which read as worse than the reflow cost it was
// meant to avoid. rAF-throttling (scheduleFrame) plus contain-layout on the pane (see its
// className) keep this affordable without distorting anything.
function applyLiveResizeStyle(panelId: PanelId, rect: PaneRect) {
  const el = document.querySelector<HTMLElement>(`[data-panel-id="${panelId}"]`)
  if (!el) return
  el.style.left = `calc(${rect.x * 100}% + ${PANE_GAP_PX}px)`
  el.style.top = `calc(${rect.y * 100}% + ${PANE_GAP_PX}px)`
  el.style.width = `calc(${rect.width * 100}% - ${PANE_GAP_PX * 2}px)`
  el.style.height = `calc(${rect.height * 100}% - ${PANE_GAP_PX * 2}px)`
}

// Cascade placement for a newly-shown pane (non-Free-canvas drop, or the Panel Library's plain
// click). Exported since legal-terminal.tsx's showPanelAt call needs it too.
export function cascadeRect(panels: PanelLayout[]): PaneRect {
  const visible = panels.filter((panel) => panel.visible && !HIDDEN_PANELS.has(panel.id))
  const offset = (visible.length % 8) * 0.04
  const width = 0.48
  const height = 0.48
  return {
    x: clamp(0.08 + offset, 0, 1 - width),
    y: clamp(0.08 + offset, 0, 1 - height),
    width,
    height,
  }
}

// Columns mode's placement rule: an explicit, in-range panel.columnIndex wins (sorted within
// that column by `order`); anything else auto-joins whichever column currently has fewest
// panes. Recomputed fresh from `panels` on every render rather than written back to state for
// auto-placed panes.
export function columnsOf(panels: PanelLayout[], columnCount: number): PanelLayout[][] {
  const columns: PanelLayout[][] = Array.from({ length: columnCount }, () => [])
  const unassigned: PanelLayout[] = []
  for (const panel of panels) {
    if (panel.columnIndex !== undefined && panel.columnIndex >= 0 && panel.columnIndex < columnCount) {
      columns[panel.columnIndex]!.push(panel)
    } else {
      unassigned.push(panel)
    }
  }
  for (const panel of unassigned) {
    columns[leastFullColumn(columns)]!.push(panel)
  }
  for (const column of columns) column.sort((a, b) => a.order - b.order)
  return columns
}

// Tabs mode's placement rule, same as Columns: an explicit, in-range panel.tabGroup wins;
// anything else auto-joins whichever of the 2 groups currently has fewer tabs, so switching
// into Tabs spreads panes across both groups instead of piling them all into the first.
export function tabGroupsOf(panels: PanelLayout[]): PanelLayout[][] {
  const groups: PanelLayout[][] = [[], []]
  const unassigned: PanelLayout[] = []
  for (const panel of [...panels].sort((a, b) => a.order - b.order)) {
    if (panel.tabGroup === 0 || panel.tabGroup === 1) groups[panel.tabGroup]!.push(panel)
    else unassigned.push(panel)
  }
  for (const panel of unassigned) {
    groups[leastFullColumn(groups)]!.push(panel)
  }
  for (const group of groups) group.sort((a, b) => a.order - b.order)
  return groups
}

export function leastFullColumn(columns: PanelLayout[][]): number {
  let target = 0
  for (let i = 1; i < columns.length; i++) {
    if (columns[i]!.length < columns[target]!.length) target = i
  }
  return target
}

// Minimal manual focus-trap dialog, local to this file rather than the shared Dialog component —
// the shared one always portals to document.body with no container override, which would drop
// the overlay out of the Terminal's forced-dark theme scope. Handles what a plain conditionally-
// rendered <div> didn't: focus moves in on mount, Tab wraps within the dialog instead of escaping
// it, Escape closes, and focus returns to whatever triggered it on unmount.
export function ModalOverlay({
  onClose,
  labelledBy,
  className,
  children,
  backdropClassName,
  originPanelId,
  ...rest
}: {
  onClose: () => void
  labelledBy: string
  className?: string
  children: ReactNode | ((close: () => void) => ReactNode)
  backdropClassName?: string
  originPanelId?: PanelId
} & Omit<ComponentPropsWithoutRef<"div">, "onClose" | "className" | "children">) {
  const ref = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const closingRef = useRef(false)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = ref.current
    const focusable = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(focusable ?? container)?.focus()
    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  const originRect = () => {
    if (!originPanelId) return null
    const candidates = document.querySelectorAll<HTMLElement>(`[data-panel-id="${CSS.escape(originPanelId)}"]`)
    return Array.from(candidates).find((el) => el !== ref.current)?.getBoundingClientRect() ?? null
  }

  useGSAP(
    () => {
      const el = ref.current
      if (!el || reducedMotion) return
      if (backdropRef.current) gsap.from(backdropRef.current, { opacity: 0, duration: 0.18 })
      const origin = originRect()
      if (origin) {
        const target = el.getBoundingClientRect()
        gsap.fromTo(
          el,
          {
            opacity: 0,
            scaleX: origin.width / target.width,
            scaleY: origin.height / target.height,
            x: origin.left + origin.width / 2 - (target.left + target.width / 2),
            y: origin.top + origin.height / 2 - (target.top + target.height / 2),
          },
          { opacity: 1, scaleX: 1, scaleY: 1, x: 0, y: 0, duration: 0.22, ease: "power2.out" },
        )
      } else {
        gsap.from(el, { opacity: 0, scale: 0.95, y: 8, duration: 0.18, ease: "power2.out" })
      }
    },
    { scope: ref, dependencies: [] },
  )

  const handleClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    const el = ref.current
    if (!el || reducedMotion) {
      onClose()
      return
    }
    if (backdropRef.current) gsap.to(backdropRef.current, { opacity: 0, duration: 0.15 })
    const origin = originRect()
    if (origin) {
      const target = el.getBoundingClientRect()
      gsap.to(el, {
        opacity: 0,
        scaleX: origin.width / target.width,
        scaleY: origin.height / target.height,
        x: origin.left + origin.width / 2 - (target.left + target.width / 2),
        y: origin.top + origin.height / 2 - (target.top + target.height / 2),
        duration: 0.22,
        ease: "power2.in",
        onComplete: onClose,
      })
      return
    }
    gsap.to(el, { opacity: 0, scale: 0.97, duration: 0.14, ease: "power1.in", onComplete: onClose })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation()
      handleClose()
      return
    }
    if (event.key !== "Tab") return
    const container = ref.current
    if (!container) return
    const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    if (focusables.length === 0) return
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const dialog = (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={backdropClassName ? (e) => e.stopPropagation() : undefined}
      className={className}
      {...rest}
    >
      {typeof children === "function" ? children(handleClose) : children}
    </div>
  )

  if (!backdropClassName) return dialog
  return (
    <div ref={backdropRef} className={backdropClassName} onClick={handleClose}>
      {dialog}
    </div>
  )
}

// Crossfades between panel bodies when the active one changes — Tabs' per-group content and
// Focus mode's "big" pane both used to swap instantly via a plain conditional render.
function AnimatedPanelBody({
  panelId,
  caseId,
  snapshot,
  onJumpToPanel,
}: {
  panelId: PanelId
  caseId: string
  snapshot: CaseSnapshot
  onJumpToPanel: (id: PanelId) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [displayedId, setDisplayedId] = useState(panelId)
  const pendingIdRef = useRef(panelId)
  const mountedRef = useRef(false)

  useGSAP(
    () => {
      if (panelId === displayedId) return
      pendingIdRef.current = panelId
      const el = containerRef.current
      if (reducedMotion || !el) {
        setDisplayedId(panelId)
        return
      }
      gsap.killTweensOf(el)
      gsap.to(el, { opacity: 0, duration: 0.12, ease: "power1.in", onComplete: () => setDisplayedId(pendingIdRef.current) })
    },
    { dependencies: [panelId] },
  )

  useGSAP(
    () => {
      if (!mountedRef.current) {
        mountedRef.current = true
        return
      }
      if (reducedMotion) return
      const el = containerRef.current
      if (!el) return
      gsap.killTweensOf(el)
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "power1.out" })
    },
    { dependencies: [displayedId] },
  )

  return (
    <div ref={containerRef} className="h-full min-h-0">
      <TerminalPanelBody panelId={displayedId} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
    </div>
  )
}

// Shared header icon cluster: Maximize/Hide (always available), Pop-out (always available),
// Pin (rendered only when the caller passes onTogglePin), and Move-to-screen (rendered only when
// the caller passes onMoveToScreen with more than one screen to move to — the layout builder's
// per-pane screen reassignment; unused in the primary Terminal, which keeps onPopOut instead).
function PaneHeaderActions({
  t,
  isMaximized,
  onToggleMaximize,
  onHide,
  onPopOut,
  pinned,
  onTogglePin,
  screenCount,
  currentScreen,
  onMoveToScreen,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string
  isMaximized: boolean
  onToggleMaximize: () => void
  onHide: () => void
  /** Sends this pane to the next physical screen and opens/reuses that screen's canvas window —
   * omitted entirely when window.screen.isExtended is false (Firefox/Safari, or a single-monitor
   * Chrome/Edge), same gating the old round-robin button used. */
  onPopOut?: () => void
  pinned?: boolean
  onTogglePin?: () => void
  screenCount?: number
  currentScreen?: number
  onMoveToScreen?: (screen: number) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {onMoveToScreen && screenCount !== undefined && screenCount > 1 && (
        <select
          value={currentScreen ?? 0}
          onChange={(e) => onMoveToScreen(Number(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={t("moveToScreen")}
          className="h-6 rounded border border-border bg-background px-1 text-[10px] text-muted-foreground"
        >
          {Array.from({ length: screenCount }, (_, i) => (
            <option key={i} value={i}>
              {t("builderDisplayLabel", { n: i + 1 })}
            </option>
          ))}
        </select>
      )}
      {onTogglePin && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onTogglePin}
              aria-pressed={!!pinned}
              className={`rounded p-1 transition-colors hover:bg-muted dark:hover:bg-overlay-hover ${
                pinned ? "text-brand-gold" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={pinned ? t("unpinPane") : t("pinPane")}
            >
              <Pin className="h-3.5 w-3.5" aria-hidden="true" fill={pinned ? "currentColor" : "none"} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{pinned ? t("unpinPane") : t("pinPane")}</TooltipContent>
        </Tooltip>
      )}
      {onPopOut && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onPopOut}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
              aria-label={t("popOutPane")}
            >
              <AppWindow className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("popOutPane")}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleMaximize}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
            aria-label={isMaximized ? t("restorePane") : t("maximizePane")}
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{isMaximized ? t("restorePane") : t("maximizePane")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onHide}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
            aria-label={t("hidePane")}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("hidePane")}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function PaneDragGhost({ label, badge, rect }: { label: string; badge?: string; rect: PaneDragPreview }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-40 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-brand-gold/70 bg-card/85 shadow-xl backdrop-blur-sm"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
      }}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-brand-gold/30 bg-brand-gold/10 px-3">
        <Grip className="h-3 w-3 text-brand-gold" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[1.2px] text-foreground">{label}</span>
        {badge && <span className="text-[9px] text-brand-gold">{badge}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 opacity-70">
        <span className="h-2 w-3/4 rounded-full bg-foreground/20" />
        <span className="h-2 w-full rounded-full bg-foreground/10" />
        <span className="h-2 w-5/6 rounded-full bg-foreground/10" />
        <span className="mt-2 h-8 w-full rounded border border-foreground/10 bg-foreground/5" />
      </div>
    </div>
  )
}

function ResizeHandle({
  edge,
  className,
  panel,
  onDown,
  onMove,
  onUp,
  onKeyDown,
  onFitToContent,
  t,
  children,
}: {
  edge: ResizeEdge
  className: string
  panel: PanelLayout
  onDown: (panel: PanelLayout, edges: ResizeEdge, event: PointerEvent<HTMLDivElement>) => void
  onMove: (event: PointerEvent<HTMLDivElement>) => void
  onUp: () => void
  onKeyDown: (panel: PanelLayout, edges: ResizeEdge, event: KeyboardEvent<HTMLDivElement>) => void
  onFitToContent?: () => void
  t: (key: string) => string
  children?: ReactNode
}) {
  const orientation = edge.e || edge.w ? "vertical" : "horizontal"
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={onFitToContent ? t("resizePaneFitHint") : t("resizePane")}
      title={onFitToContent ? t("resizePaneFitHint") : undefined}
      tabIndex={0}
      className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60`}
      onPointerDown={(event) => onDown(panel, edge, event)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onDoubleClick={onFitToContent}
      onKeyDown={(event) => {
        if (onFitToContent && event.key === "Enter") {
          event.preventDefault()
          onFitToContent()
          return
        }
        onKeyDown(panel, edge, event)
      }}
    >
      {children}
    </div>
  )
}

type ArrangementBodyProps = {
  panels: PanelLayout[]
  caseId: string
  snapshot: CaseSnapshot
  labelFor: (panel: PanelLayout | { id: PanelId }) => string
  onToggleMaximize: (id: PanelId) => void
  onHide: (id: PanelId) => void
  /** Omitted entirely (not just hidden) when no pop-out affordance should render — see
   * TerminalCanvasProps.onPopOut. */
  onPopOut?: (id: PanelId) => void
  onJumpToPanel: (id: PanelId) => void
  t: (key: string, opts?: Record<string, unknown>) => string
  onDrop: (id: PanelId) => void
  onDragPreview?: (event: DragEvent) => void
  screenCount?: number
  onMoveToScreen?: (id: PanelId, screen: number) => void
}

function dropHandlers(onDrop: (id: PanelId) => void, onDragPreview?: (event: DragEvent) => void) {
  return {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      onDragPreview?.(e)
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const id = e.dataTransfer.getData("text/x-panel-id") as PanelId
      if (id) onDrop(id)
    },
  }
}

// Fixed 2/3/4-column grid — strictly no floating. Each column stacks up to a caller-defined cap
// (enforced by the caller before a panel is ever handed here). Column borders and in-column
// stack dividers both resize with a neighbor-only trade + MIN_COLUMN_FR floor.
function ColumnsArrangement({
  panels,
  caseId,
  snapshot,
  labelFor,
  columnCount,
  columnWidths,
  onSetColumnWidths,
  onPatchPanel,
  onToggleMaximize,
  onHide,
  onPopOut,
  onJumpToPanel,
  t,
  onDrop,
  onDragPreview,
  screenCount,
  onMoveToScreen,
}: ArrangementBodyProps & {
  columnCount: number
  columnWidths: number[]
  onSetColumnWidths: (widths: number[]) => void
  onPatchPanel: (id: PanelId, patch: Partial<PanelLayout>) => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const columnDragRef = useRef<{ index: number; startX: number; widths: number[] } | null>(null)
  const columns = columnsOf(panels, columnCount)
  const widths = columnWidths.length === columnCount ? columnWidths : Array(columnCount).fill(1 / columnCount)

  const onColumnResizeDown = (index: number, e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    lockSelection()
    columnDragRef.current = { index, startX: e.clientX, widths: [...widths] }
  }
  const onColumnResizeMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = columnDragRef.current
    const grid = gridRef.current
    if (!drag || !grid || grid.clientWidth === 0) return
    if ((e.buttons & 1) === 0) {
      onColumnResizeUp()
      return
    }
    const dx = (e.clientX - drag.startX) / grid.clientWidth
    const a = drag.index
    const b = drag.index + 1
    const pairTotal = drag.widths[a]! + drag.widths[b]!
    const newA = clamp(drag.widths[a]! + dx, MIN_COLUMN_FR, pairTotal - MIN_COLUMN_FR)
    const next = [...drag.widths]
    next[a] = newA
    next[b] = pairTotal - newA
    onSetColumnWidths(next)
  }
  const onColumnResizeUp = () => {
    columnDragRef.current = null
    unlockSelection()
  }

  const onColumnResizeKeyDown = (index: number, e: KeyboardEvent<HTMLDivElement>) => {
    let dx = 0
    if (e.key === "ArrowLeft") dx = -RESIZE_KEY_STEP
    else if (e.key === "ArrowRight") dx = RESIZE_KEY_STEP
    else return
    e.preventDefault()
    const a = index
    const b = index + 1
    const pairTotal = widths[a]! + widths[b]!
    const newA = clamp(widths[a]! + dx, MIN_COLUMN_FR, pairTotal - MIN_COLUMN_FR)
    const next = [...widths]
    next[a] = newA
    next[b] = pairTotal - newA
    onSetColumnWidths(next)
  }

  return (
    <div ref={gridRef} className="flex h-full min-h-0" {...dropHandlers(onDrop, onDragPreview)}>
      {columns.map((columnPanels, columnIndex) => (
        <div key={columnIndex} className="relative flex min-h-0 min-w-0 flex-col" style={{ flex: `${widths[columnIndex]} 0 0%` }}>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-1.5">
            <ColumnStack
              panels={columnPanels}
              caseId={caseId}
              snapshot={snapshot}
              labelFor={labelFor}
              onToggleMaximize={onToggleMaximize}
              onHide={onHide}
              onPopOut={onPopOut}
              onJumpToPanel={onJumpToPanel}
              onPatchPanel={onPatchPanel}
              t={t}
              screenCount={screenCount}
              onMoveToScreen={onMoveToScreen}
            />
          </div>
          {columnIndex < columnCount - 1 && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t("resizeColumns")}
              tabIndex={0}
              onPointerDown={(e) => onColumnResizeDown(columnIndex, e)}
              onPointerMove={onColumnResizeMove}
              onPointerUp={onColumnResizeUp}
              onPointerCancel={onColumnResizeUp}
              onLostPointerCapture={onColumnResizeUp}
              onKeyDown={(e) => onColumnResizeKeyDown(columnIndex, e)}
              className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            />
          )}
        </div>
      ))}
    </div>
  )
}

function ColumnStack({
  panels,
  caseId,
  snapshot,
  labelFor,
  onToggleMaximize,
  onHide,
  onPopOut,
  onJumpToPanel,
  onPatchPanel,
  t,
  screenCount,
  onMoveToScreen,
}: {
  panels: PanelLayout[]
  caseId: string
  snapshot: CaseSnapshot
  labelFor: (panel: PanelLayout | { id: PanelId }) => string
  onToggleMaximize: (id: PanelId) => void
  onHide: (id: PanelId) => void
  onPopOut?: (id: PanelId) => void
  onJumpToPanel: (id: PanelId) => void
  onPatchPanel: (id: PanelId, patch: Partial<PanelLayout>) => void
  t: (key: string, opts?: Record<string, unknown>) => string
  screenCount?: number
  onMoveToScreen?: (id: PanelId, screen: number) => void
}) {
  const stackRef = useRef<HTMLDivElement>(null)
  const stackDragRef = useRef<{ aboveId: PanelId; belowId: PanelId; startY: number; heightAbove: number; heightBelow: number } | null>(null)
  const rawHeights = panels.map((p) => (Number.isFinite(p.height) && p.height! > 0 ? p.height! : 1 / panels.length))
  const total = rawHeights.reduce((sum, h) => sum + h, 0) || 1
  const heights = rawHeights.map((h) => h / total)

  const onStackResizeDown = (index: number, e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    lockSelection()
    stackDragRef.current = {
      aboveId: panels[index]!.id,
      belowId: panels[index + 1]!.id,
      startY: e.clientY,
      heightAbove: heights[index]!,
      heightBelow: heights[index + 1]!,
    }
  }
  const onStackResizeMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = stackDragRef.current
    const stack = stackRef.current
    if (!drag || !stack || stack.clientHeight === 0) return
    if ((e.buttons & 1) === 0) {
      onStackResizeUp()
      return
    }
    const dy = (e.clientY - drag.startY) / stack.clientHeight
    const pairTotal = drag.heightAbove + drag.heightBelow
    const newAbove = clamp(drag.heightAbove + dy, MIN_COLUMN_FR, pairTotal - MIN_COLUMN_FR)
    onPatchPanel(drag.aboveId, { height: newAbove })
    onPatchPanel(drag.belowId, { height: pairTotal - newAbove })
  }
  const onStackResizeUp = () => {
    stackDragRef.current = null
    unlockSelection()
  }

  const onStackResizeKeyDown = (index: number, e: KeyboardEvent<HTMLDivElement>) => {
    let dy = 0
    if (e.key === "ArrowUp") dy = -RESIZE_KEY_STEP
    else if (e.key === "ArrowDown") dy = RESIZE_KEY_STEP
    else return
    e.preventDefault()
    const pairTotal = heights[index]! + heights[index + 1]!
    const newAbove = clamp(heights[index]! + dy, MIN_COLUMN_FR, pairTotal - MIN_COLUMN_FR)
    onPatchPanel(panels[index]!.id, { height: newAbove })
    onPatchPanel(panels[index + 1]!.id, { height: pairTotal - newAbove })
  }

  return (
    <div ref={stackRef} className="flex min-h-0 flex-1 flex-col gap-1.5">
      {panels.map((panel, index) => (
        <div key={panel.id} className="relative flex min-h-0 min-w-0 flex-col" style={{ flex: `${heights[index]} 0 0%` }}>
          <Pane
            flipId={panel.id}
            pinned={!!panel.pinned}
            className="relative min-h-0 flex-1"
            header={
              <div className="terminal-pane-header flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted px-3">
                <PaneCode panelId={panel.id} />
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                  {labelFor(panel)}
                </span>
                <PaneActivityMark panelId={panel.id} />
                <PaneHeaderActions
                  t={t}
                  isMaximized={false}
                  onToggleMaximize={() => onToggleMaximize(panel.id)}
                  onHide={() => onHide(panel.id)}
                  onPopOut={onPopOut ? () => onPopOut(panel.id) : undefined}
                  pinned={!!panel.pinned}
                  onTogglePin={() => onPatchPanel(panel.id, { pinned: !panel.pinned })}
                  screenCount={screenCount}
                  currentScreen={panel.screen ?? 0}
                  onMoveToScreen={onMoveToScreen ? (screen) => onMoveToScreen(panel.id, screen) : undefined}
                />
              </div>
            }
          >
            <div className="min-h-0 flex-1 overflow-hidden bg-card">
              <TerminalPanelBody panelId={panel.id} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
            </div>
          </Pane>
          {index < panels.length - 1 && (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label={t("resizeColumnStack")}
              tabIndex={0}
              onPointerDown={(e) => onStackResizeDown(index, e)}
              onPointerMove={onStackResizeMove}
              onPointerUp={onStackResizeUp}
              onPointerCancel={onStackResizeUp}
              onLostPointerCapture={onStackResizeUp}
              onKeyDown={(e) => onStackResizeKeyDown(index, e)}
              className="absolute -bottom-1 left-0 z-10 h-2 w-full cursor-row-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            />
          )}
        </div>
      ))}
    </div>
  )
}

// Two independently drag-assignable, resizable, persisted tab groups.
function TabsArrangement({
  panels,
  caseId,
  snapshot,
  labelFor,
  activeA,
  activeB,
  onSetActiveA,
  onSetActiveB,
  split,
  onSetSplit,
  onPatchPanel,
  onToggleMaximize,
  onHide,
  onPopOut,
  onJumpToPanel,
  t,
  onDrop,
  onDragPreview,
  screenCount,
  onMoveToScreen,
}: ArrangementBodyProps & {
  activeA: PanelId | null
  activeB: PanelId | null
  onSetActiveA: (id: PanelId) => void
  onSetActiveB: (id: PanelId) => void
  split: number
  onSetSplit: (value: number) => void
  onPatchPanel: (id: PanelId, patch: Partial<PanelLayout>) => void
}) {
  const groupsRef = useRef<HTMLDivElement>(null)
  const splitDragRef = useRef<{ startX: number; split: number } | null>(null)
  const groups = tabGroupsOf(panels)
  const actives = [activeA, activeB]
  const setActives = [onSetActiveA, onSetActiveB]
  const widths = [split, 1 - split]

  const onSplitDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    lockSelection()
    splitDragRef.current = { startX: e.clientX, split }
  }
  const onSplitMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = splitDragRef.current
    const container = groupsRef.current
    if (!drag || !container || container.clientWidth === 0) return
    if ((e.buttons & 1) === 0) {
      onSplitUp()
      return
    }
    const dx = (e.clientX - drag.startX) / container.clientWidth
    onSetSplit(clamp(drag.split + dx, MIN_COLUMN_FR, 1 - MIN_COLUMN_FR))
  }
  const onSplitUp = () => {
    splitDragRef.current = null
    unlockSelection()
  }

  const onSplitKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let dx = 0
    if (e.key === "ArrowLeft") dx = -RESIZE_KEY_STEP
    else if (e.key === "ArrowRight") dx = RESIZE_KEY_STEP
    else return
    e.preventDefault()
    onSetSplit(clamp(split + dx, MIN_COLUMN_FR, 1 - MIN_COLUMN_FR))
  }

  const moveToGroup = (panelId: PanelId, targetGroupIndex: number) => {
    // Pin every auto-placed tab to the group it's showing in first, so moving one tab doesn't
    // re-balance the rest and make other tabs hop groups.
    groups.forEach((group, groupIndex) => {
      for (const p of group) if (p.id !== panelId && p.tabGroup !== groupIndex) onPatchPanel(p.id, { tabGroup: groupIndex })
    })
    const maxOrder = Math.max(0, ...groups[targetGroupIndex]!.map((p) => p.order))
    onPatchPanel(panelId, { tabGroup: targetGroupIndex, order: maxOrder + 1 })
  }

  const onGroupDrop = (groupIndex: number, e: DragEvent) => {
    e.preventDefault()
    const tabId = e.dataTransfer.getData("text/x-tab-id") as PanelId
    if (tabId) {
      moveToGroup(tabId, groupIndex)
      return
    }
    const newId = e.dataTransfer.getData("text/x-panel-id") as PanelId
    if (newId) onDrop(newId)
  }

  return (
    <div ref={groupsRef} className="flex h-full min-h-0">
      {groups.map((group, groupIndex) => {
        const activeId = actives[groupIndex] && group.some((p) => p.id === actives[groupIndex]) ? actives[groupIndex] : group[0]?.id
        const activePanel = group.find((p) => p.id === activeId)
        return (
          <Pane
            key={groupIndex}
            flipId={activePanel?.id}
            className="relative min-h-0 min-w-[200px]"
            style={{ flex: `${widths[groupIndex]} 0 0%` }}
            onDragOver={(e) => {
              e.preventDefault()
              onDragPreview?.(e)
            }}
            onDrop={(e) => onGroupDrop(groupIndex, e)}
            header={
              <div className="terminal-pane-header flex h-10 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-border px-2">
                {group.map((panel) => {
                  const active = panel.id === activePanel?.id
                  const isPinned = !!panel.pinned
                  return (
                    <div
                      key={panel.id}
                      draggable={!isPinned}
                      onDragStart={isPinned ? undefined : (e) => e.dataTransfer.setData("text/x-tab-id", panel.id)}
                      className={`flex items-center gap-0.5 whitespace-nowrap border-b-2 pl-2 text-[10px] font-semibold uppercase tracking-[1.2px] transition-colors ${
                        active ? "border-brand-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <button type="button" onClick={() => setActives[groupIndex]?.(panel.id)} className="inline-flex items-center gap-1.5">
                        {labelFor(panel)}
                        <PaneActivityMark panelId={panel.id} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onPatchPanel(panel.id, { pinned: !isPinned })}
                        aria-pressed={isPinned}
                        aria-label={isPinned ? t("unpinPane") : t("pinPane")}
                        className={`rounded p-1 transition-colors hover:bg-muted dark:hover:bg-overlay-hover ${
                          isPinned ? "text-brand-gold" : "text-muted-foreground/60 hover:text-foreground"
                        }`}
                      >
                        <Pin className="h-3 w-3" aria-hidden="true" fill={isPinned ? "currentColor" : "none"} />
                      </button>
                      {!isPinned && (
                        <button
                          type="button"
                          onClick={() => moveToGroup(panel.id, groupIndex === 0 ? 1 : 0)}
                          aria-label={t("moveToOtherGroup")}
                          className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                        >
                          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onHide(panel.id)}
                        aria-label={t("hidePane")}
                        className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  )
                })}
                {activePanel && (
                  <div className="ml-auto flex shrink-0 items-center gap-0.5 self-center">
                    {onMoveToScreen && screenCount !== undefined && screenCount > 1 && (
                      <select
                        value={activePanel.screen ?? 0}
                        onChange={(e) => onMoveToScreen(activePanel.id, Number(e.target.value))}
                        aria-label={t("moveToScreen")}
                        className="h-6 rounded border border-border bg-background px-1 text-[10px] text-muted-foreground"
                      >
                        {Array.from({ length: screenCount }, (_, i) => (
                          <option key={i} value={i}>
                            {t("builderDisplayLabel", { n: i + 1 })}
                          </option>
                        ))}
                      </select>
                    )}
                    {onPopOut && (
                      <button
                        type="button"
                        onClick={() => onPopOut(activePanel.id)}
                        className="flex h-6 w-6 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                        aria-label={t("popOutPane")}
                      >
                        <AppWindow className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleMaximize(activePanel.id)}
                      className="flex h-6 w-6 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                      aria-label={t("maximizePane")}
                    >
                      <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            }
            resizeHandles={
              groupIndex === 0 && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t("resizeTabGroups")}
                  tabIndex={0}
                  onPointerDown={onSplitDown}
                  onPointerMove={onSplitMove}
                  onPointerUp={onSplitUp}
                  onPointerCancel={onSplitUp}
                  onLostPointerCapture={onSplitUp}
                  onKeyDown={onSplitKeyDown}
                  className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                />
              )
            }
          >
            <div className="min-h-0 flex-1 overflow-hidden bg-card">
              {activePanel && (
                <AnimatedPanelBody panelId={activePanel.id} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
              )}
            </div>
          </Pane>
        )
      })}
    </div>
  )
}

// One large focused pane plus a clickable stack of the rest.
function FocusArrangement({
  panels,
  caseId,
  snapshot,
  labelFor,
  stackSummaries,
  panelBadges,
  focusedId,
  onFocus,
  onToggleMaximize,
  onHide,
  onPopOut,
  onJumpToPanel,
  t,
  onDrop,
  onDragPreview,
  screenCount,
  onMoveToScreen,
}: ArrangementBodyProps & {
  stackSummaries: Partial<Record<PanelId, string>>
  panelBadges: Partial<Record<PanelId, string>>
  focusedId: PanelId | null
  onFocus: (id: PanelId) => void
}) {
  const stackable = panels.filter((p) => p.id !== "chat")
  const focusId = focusedId && stackable.some((p) => p.id === focusedId) ? focusedId : stackable[0]?.id
  const focusPanel = stackable.find((p) => p.id === focusId)
  const stackRest = stackable.filter((p) => p.id !== focusId)

  return (
    <div
      className="grid h-full min-h-0 gap-3"
      style={{ gridTemplateColumns: "minmax(280px,1.4fr) 260px minmax(260px,1fr)" }}
      {...dropHandlers(onDrop, onDragPreview)}
    >
      <Pane
        flipId={focusPanel?.id}
        className="relative min-h-0"
        header={
          focusPanel && (
            <div className="terminal-pane-header flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted px-3">
              <PaneCode panelId={focusPanel.id} />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">{labelFor(focusPanel)}</span>
              <PaneActivityMark panelId={focusPanel.id} />
              <PaneHeaderActions
                t={t}
                isMaximized={false}
                onToggleMaximize={() => onToggleMaximize(focusPanel.id)}
                onHide={() => onHide(focusPanel.id)}
                onPopOut={onPopOut ? () => onPopOut(focusPanel.id) : undefined}
                screenCount={screenCount}
                currentScreen={focusPanel.screen ?? 0}
                onMoveToScreen={onMoveToScreen ? (screen) => onMoveToScreen(focusPanel.id, screen) : undefined}
              />
            </div>
          )
        }
      >
        <div className="min-h-0 flex-1 overflow-hidden bg-card">
          {focusPanel && <AnimatedPanelBody panelId={focusPanel.id} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />}
        </div>
      </Pane>
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {stackRest.map((panel) => {
          const summary = stackSummaries[panel.id] ?? panelBadges[panel.id]
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => onFocus(panel.id)}
              className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-brand-gold/40"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[1.2px] text-foreground">{labelFor(panel)}</span>
                <PaneActivityMark panelId={panel.id} />
              </span>
              {summary && <span className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">{summary}</span>}
            </button>
          )
        })}
      </div>
      <Pane
        pinned
        className="relative min-h-0"
        header={
          <div className="terminal-pane-header flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted px-3">
            <PaneCode panelId="chat" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">{labelFor({ id: "chat" })}</span>
            <button
              type="button"
              onClick={() => onToggleMaximize("chat")}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
              aria-label={t("maximizePane")}
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        }
      >
        <div className="min-h-0 flex-1 overflow-hidden bg-card">
          <TerminalPanelBody panelId="chat" caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
        </div>
      </Pane>
    </div>
  )
}

export interface TerminalCanvasProps {
  caseId: string
  stageRef: RefObject<HTMLDivElement | null>
  snapshot: CaseSnapshot
  visiblePanels: PanelLayout[]
  labelFor: (panel: PanelLayout | { id: PanelId }) => string
  panelBadges: Partial<Record<PanelId, string>>
  focusStackSummaries: Partial<Record<PanelId, string>>
  panelLabels: boolean
  t: (key: string, opts?: Record<string, unknown>) => string

  arrangement: ArrangementValue
  columnCount: number
  columnWidths: number[]
  tabsSplit: number
  tabsActiveA: PanelId | null
  tabsActiveB: PanelId | null
  onSetColumnWidths: (widths: number[]) => void
  onSetTabsSplit: (value: number) => void
  onSetTabsActiveA: (id: PanelId) => void
  onSetTabsActiveB: (id: PanelId) => void

  onPatchPanel: (id: PanelId, patch: Partial<PanelLayout>) => void
  onHide: (id: PanelId) => void
  /** Sends this pane to the next physical screen and opens/reuses that screen's canvas window —
   * pass undefined (not just a no-op) to hide the affordance entirely, e.g. when
   * window.screen.isExtended is false. */
  onPopOut?: (id: PanelId) => void
  onJumpToPanel: (id: PanelId) => void
  onBringToFront: (id: PanelId) => void
  /** How many screens the caller's whole workspace spans (1 = just this one) and a handler to
   * reassign a pane to a different one — the layout builder's per-pane "move to screen" control.
   * Omitted (or screenCount <= 1) hides the control entirely; the primary Terminal doesn't pass
   * these (it keeps onPopOut instead). */
  screenCount?: number
  onMoveToScreen?: (id: PanelId, screen: number) => void

  maximizedId: PanelId | null
  onToggleMaximize: (id: PanelId) => void
  focusedId: PanelId | null
  onFocus: (id: PanelId) => void

  dragPreview: PaneDragPreview | null
  onDragPreviewChange: (preview: PaneDragPreview | null) => void
  draggingId: PanelId | null
  onDraggingIdChange: (id: PanelId | null) => void

  /** Columns/Tabs/Focus drop target — new pane from the sidebar/library dropped without an
   * explicit rect. Caller decides cap-check + placement (identical to today's requestAddPanel). */
  onDropNew: (id: PanelId) => void
  /** Free canvas only — a drop at an explicit rect (drag-drop from the sidebar or a re-cascade). */
  onDropAtRect: (id: PanelId, rect: PaneRect, sourceRect: DOMRect) => void
  /** Columns/Tabs/Focus's shared drag-preview updater (reads stageRef bounds). */
  onDragPreviewUpdate?: (event: DragEvent) => void

  emptyStateAction?: { label: string; onClick: () => void }

  /** Extra content rendered inside the stage (e.g. legal-terminal.tsx's New Layout / Replace
   * Pane dialogs), positioned exactly where they sat before extraction. */
  children?: ReactNode
}

/** The arrangement/grid rendering pulled out of legal-terminal.tsx (Free/Columns/Tabs/Focus,
 * drag/resize, the maximize overlay) so it can be mounted for any screen — the primary window's
 * screen 0, or a secondary canvas window (see canvas/[screenIndex]/page.tsx). Purely controlled
 * by props: no knowledge of workspace switching, presets, or the sidebar. */
export function TerminalCanvas({
  caseId,
  stageRef,
  snapshot,
  visiblePanels,
  labelFor,
  panelBadges,
  focusStackSummaries,
  panelLabels,
  t,
  arrangement,
  columnCount,
  columnWidths,
  tabsSplit,
  tabsActiveA,
  tabsActiveB,
  onSetColumnWidths,
  onSetTabsSplit,
  onSetTabsActiveA,
  onSetTabsActiveB,
  onPatchPanel,
  onHide,
  onPopOut,
  onJumpToPanel,
  onBringToFront,
  screenCount,
  onMoveToScreen,
  maximizedId,
  onToggleMaximize,
  focusedId,
  onFocus,
  dragPreview,
  onDragPreviewChange,
  draggingId,
  onDraggingIdChange,
  onDropNew,
  onDropAtRect,
  onDragPreviewUpdate,
  emptyStateAction,
  children,
}: TerminalCanvasProps) {
  const resizeRef = useRef<ResizeDrag | null>(null)
  const moveRef = useRef<MoveDrag | null>(null)
  // Drag/resize used to call a full layout update on every raw pointermove — a measured cause
  // of visible lag. Now both are throttled to one DOM write per animation frame, and
  // grid-snapping is applied only once, on pointer-up.
  const liveStyleRafRef = useRef<number | null>(null)

  // Free canvas renders panes in a stable DOM order (by id) rather than visiblePanels' own order:
  // stacking there comes from the inline `zIndex: panel.order + 1`, and rendering by `order` made
  // every bringToFront physically move the pane's node to the end of the list. A DOM move
  // mid-gesture silently drops pointer capture (killing resize drags after the first pointermove —
  // see onResizePointerMove's safety net) and can swallow clicks/focus inside the raised pane.
  const freeCanvasPanels = useMemo(() => [...visiblePanels].sort((a, b) => a.id.localeCompare(b.id)), [visiblePanels])

  const scheduleFrame = (fn: () => void) => {
    if (liveStyleRafRef.current != null) cancelAnimationFrame(liveStyleRafRef.current)
    liveStyleRafRef.current = requestAnimationFrame(() => {
      liveStyleRafRef.current = null
      fn()
    })
  }
  const cancelFrame = () => {
    if (liveStyleRafRef.current != null) {
      cancelAnimationFrame(liveStyleRafRef.current)
      liveStyleRafRef.current = null
    }
  }

  const patchPanelRect = (panelId: PanelId, rect: PaneRect) => onPatchPanel(panelId, rect)

  const onResizePointerDown = (panel: PanelLayout, edges: ResizeEdge, event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    lockSelection()
    const rect = panelRect(panel)
    onBringToFront(panel.id)
    resizeRef.current = { panelId: panel.id, edges, startX: event.clientX, startY: event.clientY, ...rect }
  }

  const endResize = () => {
    const drag = resizeRef.current
    if (drag && drag.lastDx !== undefined && drag.lastDy !== undefined) {
      patchPanelRect(drag.panelId, clampResize(drag, drag.lastDx, drag.lastDy, true))
    }
    cancelFrame()
    resizeRef.current = null
    unlockSelection()
  }

  const onResizePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = resizeRef.current
    const grid = document.getElementById("terminal-grid")
    if (!drag || !grid || grid.clientWidth === 0 || grid.clientHeight === 0) return
    if ((event.buttons & 1) === 0) {
      endResize()
      return
    }
    const dx = (event.clientX - drag.startX) / grid.clientWidth
    const dy = (event.clientY - drag.startY) / grid.clientHeight
    drag.lastDx = dx
    drag.lastDy = dy
    const rect = clampResize(drag, dx, dy, false)
    scheduleFrame(() => applyLiveResizeStyle(drag.panelId, rect))
  }

  const onResizePointerUp = endResize

  const fitPaneHeightToContent = (panel: PanelLayout, edge: "n" | "s") => {
    const grid = document.getElementById("terminal-grid")
    const paneEl = document.querySelector<HTMLElement>(`[data-panel-id="${CSS.escape(panel.id)}"]`)
    const contentEl = paneEl?.querySelector<HTMLElement>("[data-panel-scroll]")
    const headerEl = paneEl?.querySelector<HTMLElement>(".terminal-pane-header")
    if (!grid || !paneEl || !contentEl || grid.clientHeight === 0) return
    const naturalHeightPx = contentEl.scrollHeight + (headerEl?.offsetHeight ?? 0) + 2
    const rect = panelRect(panel)
    const naturalHeight = naturalHeightPx / grid.clientHeight
    const dy = edge === "s" ? naturalHeight - rect.height : rect.height - naturalHeight
    const drag: ResizeDrag = { panelId: panel.id, edges: { [edge]: true }, startX: 0, startY: 0, ...rect }
    patchPanelRect(panel.id, clampResize(drag, 0, dy, true))
  }

  const onHeaderPointerDown = (panel: PanelLayout, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    lockSelection()
    moveRef.current = { panelId: panel.id, startX: event.clientX, startY: event.clientY, armed: false, ...panelRect(panel) }
    const el = document.querySelector<HTMLElement>(`[data-panel-id="${panel.id}"]`)
    if (el) el.style.willChange = "transform"
  }

  const endHeaderMove = () => {
    const move = moveRef.current
    if (move?.armed && move.lastDx !== undefined && move.lastDy !== undefined) {
      const x = snapPosition(move.x + move.lastDx, 1 - move.width, GRID_SNAP_STEP)
      const y = snapPosition(move.y + move.lastDy, 1 - move.height, GRID_SNAP_STEP)
      patchPanelRect(move.panelId, { x, y, width: move.width, height: move.height })
    }
    if (move) clearLiveMoveTransform(move.panelId)
    if (move?.armed) onBringToFront(move.panelId)
    cancelFrame()
    moveRef.current = null
    onDraggingIdChange(null)
    unlockSelection()
  }

  const onHeaderPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const move = moveRef.current
    const grid = document.getElementById("terminal-grid")
    if (!move || !grid || grid.clientWidth === 0 || grid.clientHeight === 0) return
    if ((event.buttons & 1) === 0) {
      endHeaderMove()
      return
    }
    const distance = Math.hypot(event.clientX - move.startX, event.clientY - move.startY)
    if (!move.armed && distance < 6) return
    move.armed = true
    onDraggingIdChange(move.panelId)
    const dx = (event.clientX - move.startX) / grid.clientWidth
    const dy = (event.clientY - move.startY) / grid.clientHeight
    move.lastDx = dx
    move.lastDy = dy
    const clampedX = clamp(move.x + dx, 0, 1 - move.width)
    const clampedY = clamp(move.y + dy, 0, 1 - move.height)
    const dxPx = (clampedX - move.x) * grid.clientWidth
    const dyPx = (clampedY - move.y) * grid.clientHeight
    scheduleFrame(() => applyLiveMoveTransform(move.panelId, dxPx, dyPx))
  }

  const onHeaderPointerUp = endHeaderMove

  const onResizeKeyDown = (panel: PanelLayout, edges: ResizeEdge, event: KeyboardEvent<HTMLDivElement>) => {
    let dx = 0
    let dy = 0
    if (event.key === "ArrowLeft") dx = -RESIZE_KEY_STEP
    else if (event.key === "ArrowRight") dx = RESIZE_KEY_STEP
    else if (event.key === "ArrowUp") dy = -RESIZE_KEY_STEP
    else if (event.key === "ArrowDown") dy = RESIZE_KEY_STEP
    else return
    event.preventDefault()
    const drag: ResizeDrag = { panelId: panel.id, edges, startX: 0, startY: 0, ...panelRect(panel) }
    patchPanelRect(panel.id, clampResize(drag, dx, dy, true))
  }

  const onHeaderKeyDown = (panel: PanelLayout, event: KeyboardEvent<HTMLDivElement>) => {
    const rect = panelRect(panel)
    let { x, y } = rect
    if (event.key === "ArrowLeft") x = snapPosition(x - GRID_SNAP_STEP, 1 - rect.width, GRID_SNAP_STEP)
    else if (event.key === "ArrowRight") x = snapPosition(x + GRID_SNAP_STEP, 1 - rect.width, GRID_SNAP_STEP)
    else if (event.key === "ArrowUp") y = snapPosition(y - GRID_SNAP_STEP, 1 - rect.height, GRID_SNAP_STEP)
    else if (event.key === "ArrowDown") y = snapPosition(y + GRID_SNAP_STEP, 1 - rect.height, GRID_SNAP_STEP)
    else return
    event.preventDefault()
    patchPanelRect(panel.id, { ...rect, x, y })
  }

  const maximizedPanel = maximizedId ? visiblePanels.find((p) => p.id === maximizedId) : undefined

  return (
    <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden p-3">
      {visiblePanels.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
          <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-dashed border-border/80 bg-card/70 px-6 py-10 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
              <LayoutPanelLeft className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-[1.4px] text-foreground">{t("emptyLayoutTitle")}</h2>
            <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{t("emptyLayoutDescription")}</p>
            {emptyStateAction && (
              <button
                type="button"
                onClick={emptyStateAction.onClick}
                className="pointer-events-auto mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-gold px-3.5 text-[10px] font-semibold uppercase tracking-[1px] text-brand-gold-foreground transition-colors hover:bg-brand-gold/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {emptyStateAction.label}
              </button>
            )}
          </div>
        </div>
      )}
      {arrangement !== "free" && dragPreview && (
        <PaneDragGhost label={labelFor({ id: dragPreview.panelId })} badge={panelBadges[dragPreview.panelId]} rect={dragPreview} />
      )}

      {arrangement === "free" && (
        <div
          id="terminal-grid"
          className="terminal-grid-texture relative h-full min-h-0"
          onDragOver={(e) => {
            e.preventDefault()
            const id = e.dataTransfer.getData("text/x-panel-id") as PanelId
            if (!id) return
            const bounds = e.currentTarget.getBoundingClientRect()
            const width = 0.32
            const height = 0.32
            const x = clamp(snapValue(clamp((e.clientX - bounds.left) / bounds.width, 0, 1 - width), GRID_SNAP_STEP), 0, 1 - width)
            const y = clamp(snapValue(clamp((e.clientY - bounds.top) / bounds.height, 0, 1 - height), GRID_SNAP_STEP), 0, 1 - height)
            onDragPreviewChange({ panelId: id, x, y, width, height })
          }}
          onDrop={(e) => {
            e.preventDefault()
            const id = e.dataTransfer.getData("text/x-panel-id") as PanelId
            if (!id) return
            const bounds = e.currentTarget.getBoundingClientRect()
            const width = 0.32
            const height = 0.32
            const x = clamp(snapValue(clamp((e.clientX - bounds.left) / bounds.width, 0, 1 - width), GRID_SNAP_STEP), 0, 1 - width)
            const y = clamp(snapValue(clamp((e.clientY - bounds.top) / bounds.height, 0, 1 - height), GRID_SNAP_STEP), 0, 1 - height)
            const preview = dragPreview?.panelId === id ? dragPreview : { x, y, width, height }
            const sourceRect = new DOMRect(
              bounds.left + preview.x * bounds.width,
              bounds.top + preview.y * bounds.height,
              preview.width * bounds.width,
              preview.height * bounds.height,
            )
            onDropAtRect(id, { x, y, width, height }, sourceRect)
            onDragPreviewChange(null)
          }}
        >
          {dragPreview && (
            <PaneDragGhost label={labelFor({ id: dragPreview.panelId })} badge={panelBadges[dragPreview.panelId]} rect={dragPreview} />
          )}
          {freeCanvasPanels.map((panel) => {
            const rect = panelRect(panel)
            const label = labelFor(panel)
            const isDragging = draggingId === panel.id
            const isPinned = !!panel.pinned
            return (
              <Pane
                key={panel.id}
                panelId={panel.id}
                flipId={panel.id}
                pinned={isPinned}
                data-panel-labels={panelLabels ? "on" : "off"}
                className={`terminal-pane absolute contain-layout ${isDragging ? "shadow-xl ring-brand-gold/50" : ""}`}
                style={{
                  left: `calc(${rect.x * 100}% + ${PANE_GAP_PX}px)`,
                  top: `calc(${rect.y * 100}% + ${PANE_GAP_PX}px)`,
                  width: `calc(${rect.width * 100}% - ${PANE_GAP_PX * 2}px)`,
                  height: `calc(${rect.height * 100}% - ${PANE_GAP_PX * 2}px)`,
                  zIndex: isDragging ? 80 : panel.order + 1,
                }}
                onPointerDown={() => onBringToFront(panel.id)}
                header={
                  <div
                    role={isPinned ? undefined : "button"}
                    tabIndex={isPinned ? undefined : 0}
                    aria-label={isPinned ? undefined : t("dragHint")}
                    onPointerDown={isPinned ? undefined : (e) => onHeaderPointerDown(panel, e)}
                    onPointerMove={isPinned ? undefined : onHeaderPointerMove}
                    onPointerUp={isPinned ? undefined : onHeaderPointerUp}
                    onPointerCancel={isPinned ? undefined : onHeaderPointerUp}
                    onLostPointerCapture={isPinned ? undefined : onHeaderPointerUp}
                    onKeyDown={isPinned ? undefined : (e) => onHeaderKeyDown(panel, e)}
                    className={`terminal-pane-header flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-inset ${
                      isPinned ? "" : "cursor-grab active:cursor-grabbing"
                    }`}
                    title={isPinned ? t("pinnedHint") : t("dragHint")}
                  >
                    <Grip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <PaneCode panelId={panel.id} />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                      {label}
                    </span>
                    <PaneActivityMark panelId={panel.id} />
                    <PaneHeaderActions
                      t={t}
                      isMaximized={false}
                      onToggleMaximize={() => onToggleMaximize(panel.id)}
                      onHide={() => onHide(panel.id)}
                      onPopOut={onPopOut ? () => onPopOut(panel.id) : undefined}
                      pinned={isPinned}
                      onTogglePin={() => onPatchPanel(panel.id, { pinned: !isPinned })}
                      screenCount={screenCount}
                      currentScreen={panel.screen ?? 0}
                      onMoveToScreen={onMoveToScreen ? (screen) => onMoveToScreen(panel.id, screen) : undefined}
                    />
                  </div>
                }
                resizeHandles={
                  !isPinned && (
                    <>
                      <ResizeHandle edge={{ n: true }} className="absolute -top-1 left-3 right-3 z-20 h-2 cursor-n-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} onFitToContent={() => fitPaneHeightToContent(panel, "n")} t={t} />
                      <ResizeHandle edge={{ s: true }} className="absolute -bottom-1 left-3 right-3 z-20 h-2 cursor-s-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} onFitToContent={() => fitPaneHeightToContent(panel, "s")} t={t} />
                      <ResizeHandle edge={{ e: true }} className="absolute -right-1 top-3 bottom-3 z-20 w-2 cursor-e-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                      <ResizeHandle edge={{ w: true }} className="absolute -left-1 top-3 bottom-3 z-20 w-2 cursor-w-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                      <ResizeHandle edge={{ n: true, w: true }} className="absolute -left-1 -top-1 z-30 h-3 w-3 cursor-nw-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                      <ResizeHandle edge={{ n: true, e: true }} className="absolute -right-1 -top-1 z-30 h-3 w-3 cursor-ne-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                      <ResizeHandle edge={{ s: true, w: true }} className="absolute -bottom-1 -left-1 z-30 h-3 w-3 cursor-sw-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                      <ResizeHandle
                        edge={{ s: true, e: true }}
                        className="absolute -bottom-0.5 -right-0.5 z-30 flex h-4 w-4 cursor-se-resize items-end justify-end p-0.5"
                        panel={panel}
                        onDown={onResizePointerDown}
                        onMove={onResizePointerMove}
                        onUp={onResizePointerUp}
                        onKeyDown={onResizeKeyDown}
                        t={t}
                      >
                        <span className="h-2 w-2 rounded-sm border-b-2 border-r-2 border-muted-foreground/70" aria-hidden="true" />
                      </ResizeHandle>
                    </>
                  )
                }
              >
                <div className="min-h-0 flex-1 overflow-hidden bg-card">
                  <TerminalPanelBody panelId={panel.id} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
                </div>
              </Pane>
            )
          })}
        </div>
      )}

      {arrangement === "columns" && visiblePanels.length > 0 && (
        <ColumnsArrangement
          panels={visiblePanels}
          caseId={caseId}
          snapshot={snapshot}
          labelFor={labelFor}
          columnCount={columnCount}
          columnWidths={columnWidths}
          onSetColumnWidths={onSetColumnWidths}
          onPatchPanel={onPatchPanel}
          onToggleMaximize={onToggleMaximize}
          onHide={onHide}
          onPopOut={onPopOut}
          onJumpToPanel={onJumpToPanel}
          t={t}
          onDrop={onDropNew}
          onDragPreview={onDragPreviewUpdate}
          screenCount={screenCount}
          onMoveToScreen={onMoveToScreen}
        />
      )}

      {arrangement === "tabs" && visiblePanels.length > 0 && (
        <TabsArrangement
          panels={visiblePanels}
          caseId={caseId}
          snapshot={snapshot}
          labelFor={labelFor}
          activeA={tabsActiveA}
          activeB={tabsActiveB}
          onSetActiveA={onSetTabsActiveA}
          onSetActiveB={onSetTabsActiveB}
          split={tabsSplit}
          onSetSplit={onSetTabsSplit}
          onPatchPanel={onPatchPanel}
          onToggleMaximize={onToggleMaximize}
          onHide={onHide}
          onPopOut={onPopOut}
          onJumpToPanel={onJumpToPanel}
          t={t}
          onDrop={onDropNew}
          onDragPreview={onDragPreviewUpdate}
          screenCount={screenCount}
          onMoveToScreen={onMoveToScreen}
        />
      )}

      {arrangement === "focus" && visiblePanels.length > 0 && (
        <FocusArrangement
          panels={visiblePanels}
          caseId={caseId}
          snapshot={snapshot}
          labelFor={labelFor}
          stackSummaries={focusStackSummaries}
          panelBadges={panelBadges}
          focusedId={focusedId}
          onFocus={onFocus}
          onToggleMaximize={onToggleMaximize}
          onHide={onHide}
          onPopOut={onPopOut}
          onJumpToPanel={onJumpToPanel}
          t={t}
          onDrop={onDropNew}
          onDragPreview={onDragPreviewUpdate}
          screenCount={screenCount}
          onMoveToScreen={onMoveToScreen}
        />
      )}

      {children}

      {maximizedPanel && (
        <ModalOverlay
          onClose={() => onToggleMaximize(maximizedPanel.id)}
          labelledBy="maximized-pane-title"
          originPanelId={maximizedPanel.id}
          data-panel-id={maximizedPanel.id}
          className="terminal-pane absolute inset-3 z-[90] flex flex-col rounded-lg border border-brand-gold/40 bg-card shadow-2xl focus:outline-none"
        >
          {(close) => (
            <>
              <div className="terminal-pane-header flex h-9 shrink-0 items-center gap-2 rounded-t-lg border-b border-border bg-muted px-3">
                <PaneCode panelId={maximizedPanel.id} />
                <span id="maximized-pane-title" className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                  {labelFor(maximizedPanel)}
                </span>
                <PaneActivityMark panelId={maximizedPanel.id} />
                <PaneHeaderActions
                  t={t}
                  isMaximized
                  onToggleMaximize={close}
                  onHide={() => onHide(maximizedPanel.id)}
                  onPopOut={onPopOut ? () => onPopOut(maximizedPanel.id) : undefined}
                  pinned={!!maximizedPanel.pinned}
                  onTogglePin={() => onPatchPanel(maximizedPanel.id, { pinned: !maximizedPanel.pinned })}
                  screenCount={screenCount}
                  currentScreen={maximizedPanel.screen ?? 0}
                  onMoveToScreen={onMoveToScreen ? (screen) => onMoveToScreen(maximizedPanel.id, screen) : undefined}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-b-lg bg-card">
                <TerminalPanelBody panelId={maximizedPanel.id} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
              </div>
            </>
          )}
        </ModalOverlay>
      )}
    </div>
  )
}
