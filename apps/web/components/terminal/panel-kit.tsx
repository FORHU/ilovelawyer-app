import { type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"
import { cn } from "@workspace/ui/lib/utils"

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
export function PanelRowList({ children }: { children: ReactNode }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-border divide-y divide-border">
      {children}
    </ul>
  )
}

export function PanelRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <li className={cn("flex items-center gap-2.5 px-3 py-2.5", className)}>
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
