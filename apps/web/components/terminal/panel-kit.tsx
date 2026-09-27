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
import gsap from "gsap"
import { Flip } from "gsap/Flip"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"
import { cn } from "@workspace/ui/lib/utils"

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

  return (
    <ul
      ref={listRef}
      className={bare ? "flex flex-col" : "overflow-hidden rounded-lg border border-border divide-y divide-border"}
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
