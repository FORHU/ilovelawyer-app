"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CircleCheck, PanelLeft, PanelLeftClose, Plus, Search, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { MobileDrawer } from "@/components/mobile-drawer"
import { PANEL_TITLES } from "@/components/terminal/legal-terminal"
import { PANE_CATEGORY_META, PANE_CATEGORY_ORDER, PANEL_CATEGORY } from "@/components/terminal/terminal-pane-categories"
import type { PanelCatalogEntry, PanelId } from "@/lib/terminal/types"

interface TerminalSettingsSidebarProps {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  // Lifted out of this component (mirrors ConsultationSidebar) so a trigger button can render
  // inline with the Case Row instead of this component's own floating circle overlaying it —
  // that floating button used to sit directly on top of the "Back to Case" link below `lg`.
  isMobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  allPanels: PanelCatalogEntry[]
  visiblePanelIds: PanelId[]
  // Real, non-fabricated per-pane status text ("3 docs", "2 found", "Ready" — see
  // computePanelBadges in legal-terminal.tsx). Absent entries render no badge.
  panelBadges: Partial<Record<PanelId, string>>
  onAddPanel: (id: PanelId) => void
  onPanelDragStart?: (id: PanelId) => void
  onPanelDragEnd?: () => void
}

export default function TerminalSettingsSidebar({
  expanded,
  onExpandedChange,
  isMobileOpen,
  onMobileOpenChange,
  allPanels,
  visiblePanelIds,
  panelBadges,
  onAddPanel,
  onPanelDragStart,
  onPanelDragEnd,
}: TerminalSettingsSidebarProps) {
  const { t } = useTranslation("terminal")
  const [query, setQuery] = useState("")
  const asideRef = useRef<HTMLElement>(null)

  const visibleSet = useMemo(() => new Set(visiblePanelIds), [visiblePanelIds])

  const groupedPanels = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = allPanels.filter((panel) => {
      const label = PANEL_TITLES[panel.id] ?? panel.label
      return !q || label.toLowerCase().includes(q)
    })
    return PANE_CATEGORY_ORDER.map((category) => ({
      category,
      panels: matches.filter((panel) => PANEL_CATEGORY[panel.id] === category),
    })).filter((group) => group.panels.length > 0)
  }, [allPanels, query])

  // Collapse on an outside click, mirroring ConsultationSidebar — no overlay so it
  // doesn't block scrolling/dragging elsewhere on the grid.
  useEffect(() => {
    if (!expanded || isMobileOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        onExpandedChange(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [expanded, isMobileOpen, onExpandedChange])

  useEffect(() => {
    if (!isMobileOpen) return
    const handleResize = () => {
      if (window.innerWidth >= 768) onMobileOpenChange(false)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isMobileOpen, onMobileOpenChange])

  const searchBox = (
    <label className="mx-2 mb-3 flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-muted px-3 text-muted-foreground focus-within:border-brand-gold/60">
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("paneLibrarySearch", { count: allPanels.length })}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  )

  const list = (isMobile: boolean) =>
    groupedPanels.length === 0 ? (
      <p className="mx-2 rounded-md bg-muted px-3 py-4 text-center text-xs text-muted-foreground">{t("panelLibraryEmpty")}</p>
    ) : (
      <div className="flex flex-col gap-4 px-2">
        {groupedPanels.map(({ category, panels }) => {
          const meta = PANE_CATEGORY_META[category]
          const Icon = meta.icon
          return (
            <div key={category} className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
                <Icon className="h-3 w-3" aria-hidden="true" />
                {t(meta.labelKey)}
              </span>
              <ul className="flex flex-col gap-0.5">
                {panels.map((panel) => {
                  const onScreen = visibleSet.has(panel.id)
                  const badge = panelBadges[panel.id]
                  const row = (
                    <button
                      type="button"
                      data-panel-library-id={panel.id}
                      draggable={!onScreen}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/x-panel-id", panel.id)
                        onPanelDragStart?.(panel.id)
                      }}
                      onDragEnd={onPanelDragEnd}
                      onClick={() => {
                        if (onScreen) return
                        onAddPanel(panel.id)
                        if (isMobile) onMobileOpenChange(false)
                      }}
                      className={`flex w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-left text-[13px] transition-colors ${
                        onScreen
                          ? "cursor-default text-foreground"
                          : "cursor-grab text-foreground hover:border-border hover:bg-muted dark:hover:bg-overlay-hover active:cursor-grabbing"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{PANEL_TITLES[panel.id] ?? panel.label}</span>
                      <span className="shrink-0 whitespace-nowrap text-[10.5px] text-muted-foreground">{badge ?? "—"}</span>
                      {onScreen ? (
                        <CircleCheck className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-label={t("alreadyOnLayout")} />
                      ) : (
                        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                      )}
                    </button>
                  )
                  return (
                    <li key={panel.id}>
                      {/* This row can't add-on-click once a panel is already on screen (see
                       * the onClick guard above), so it's easy to read the checkmark as inert
                       * status with no way back — the tooltip is the only place that tells you
                       * removal still exists, just via the pane's own close (X) in the grid. */}
                      {onScreen ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{row}</TooltipTrigger>
                          <TooltipContent side="right">{t("removePaneHint")}</TooltipContent>
                        </Tooltip>
                      ) : (
                        row
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    )

  const footerHint = (
    <p className="shrink-0 border-t border-border px-4 py-3 text-[11px] leading-4 text-muted-foreground">
      {t("panelLibraryHint")}
    </p>
  )

  return (
    <>
      <aside
        ref={asideRef}
        className={`absolute inset-y-0 left-0 z-(--z-sidebar) hidden flex-col overflow-hidden border-r border-border bg-sidebar py-3 shadow-lg transition-[width] duration-200 lg:flex ${
          expanded ? "w-72" : "w-16"
        }`}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              aria-label={expanded ? t("sidebarCollapse") : t("sidebarOpen")}
              className={`mx-2 mb-2 flex h-9 shrink-0 items-center rounded-md hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/30 ${
                expanded ? "justify-between px-2.5" : "justify-center px-0"
              }`}
            >
              {expanded && (
                <span className="text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                  {t("panelLibrary")}
                </span>
              )}
              {expanded ? (
                <PanelLeftClose className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <PanelLeft className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{expanded ? t("sidebarCollapse") : t("sidebarOpen")}</TooltipContent>
        </Tooltip>
        {/* Collapsed-rail category icons — a quick visual index into what's grouped below;
         * clicking any of them just opens the library, same as the toggle button above. */}
        {!expanded && (
          <div className="flex flex-col items-center gap-1">
            {PANE_CATEGORY_ORDER.map((category) => {
              const meta = PANE_CATEGORY_META[category]
              const Icon = meta.icon
              return (
                <Tooltip key={category}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onExpandedChange(true)}
                      aria-label={t(meta.labelKey)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t(meta.labelKey)}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        )}
        {/* Kept mounted (not conditionally rendered) and cross-faded instead — mounting it
         * only once `expanded` is already true made the text pop in at full width instantly
         * while the aside was still mid-animation on its own 200ms width transition, so it
         * visibly reflowed/rewrapped every frame as the width grew. The opacity transition's
         * delay is tuned to trail the width transition on expand (so text only appears once
         * there's room for it) and lead it on collapse (so text disappears before the width
         * starts shrinking under it).
         * Only the category list scrolls (min-h-0 + overflow-y-auto on its own wrapper) — the
         * search box above and the hint footer below stay fixed, matching the mock exactly. */}
        <div
          aria-hidden={!expanded}
          className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity ${
            expanded ? "duration-150 delay-150 opacity-100" : "pointer-events-none duration-75 opacity-0"
          }`}
        >
          {searchBox}
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">{list(false)}</div>
          {footerHint}
        </div>
      </aside>

      <MobileDrawer
        open={isMobileOpen}
        onClose={() => onMobileOpenChange(false)}
        closeLabel={t("sidebarClose")}
        side="left"
        panelClassName="w-[85vw] max-w-80 bg-sidebar py-3"
      >
        <div className="flex shrink-0 items-center justify-between px-3 pb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">{t("panelLibrary")}</span>
          <button
            type="button"
            onClick={() => onMobileOpenChange(false)}
            aria-label={t("sidebarClose")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/30"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {searchBox}
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">{list(true)}</div>
        {footerHint}
      </MobileDrawer>
    </>
  )
}
