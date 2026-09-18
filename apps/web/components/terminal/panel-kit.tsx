import {
  Children,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"
import gsap from "gsap"
import { Flip } from "gsap/Flip"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"
import { usePrefersReducedMotion } from "@/lib/terminal/use-reduced-motion"
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

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">
      {children}
    </p>
  )
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
// of letting them snap into the vacated space. Known gap: several panels swap their whole
// `PanelRowList` for an `<EmptyNote>` once the last row is gone (see e.g. witness-panel.tsx) —
// that parent-level swap unmounts this component outright, so the very last row in a list never
// gets to play its exit animation. Not worth threading an "animating out" flag through every
// panel's empty-state check for that one edge case.
export function PanelRowList({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLUListElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<Record<string, unknown>>[]
  const keys = items.map((item) => String(item.key))
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

  return (
    <ul ref={listRef} className="overflow-hidden rounded-lg border border-border divide-y divide-border">
      {rendered.map((item) => cloneElement(item, { "data-row-key": String(item.key) }))}
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
const DENSE_GAP = { "3": "gap-1.5", "4": "gap-2.5", "5": "gap-3" } as const
const NORMAL_GAP = { "3": "gap-3", "4": "gap-4", "5": "gap-5" } as const

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
      className={`flex h-full min-h-0 flex-col ${dense ? DENSE_GAP[gap] : NORMAL_GAP[gap]} overflow-y-auto ${
        dense ? "p-2.5 text-[13px]" : "p-4 text-sm"
      } text-foreground`}
    >
      {children}
    </div>
  )
}
