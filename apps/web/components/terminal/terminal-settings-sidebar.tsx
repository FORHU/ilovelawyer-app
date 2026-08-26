"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { PanelLeft, PanelLeftClose, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"
import { PANEL_TITLES, PRESET_LABELS } from "@/components/terminal/legal-terminal"
import type { PanelCatalogEntry, PanelId, PresetValue, TerminalWorkspace } from "@/lib/terminal/types"

interface TerminalSettingsSidebarProps {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  hiddenPanels: PanelCatalogEntry[]
  onAddPanel: (id: PanelId) => void
  suggestedPanels: Array<{ panel: PanelCatalogEntry; count: number }>
  onAddSuggested: () => void
  presets: PresetValue[]
  currentPreset: PresetValue
  onSelectPreset: (preset: PresetValue) => void
  workspaces: TerminalWorkspace[]
  selectedWorkspaceId: string
  onSelectWorkspace: (id: string) => void
  onUpdateWorkspace: () => void
  updateDisabled: boolean
  workspaceName: string
  onWorkspaceNameChange: (value: string) => void
  onSaveWorkspace: () => void
  saveDisabled: boolean
  onResetWorkspace: () => void
}

const sectionLabelClass = "mb-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted-foreground"
const fieldClass =
  "h-8 w-full rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
const primaryBtnClass =
  "h-8 w-full rounded-md bg-brand-gold px-3 text-[10px] font-semibold uppercase tracking-[1px] text-brand-navy-950 transition-colors hover:bg-brand-gold/85 disabled:opacity-50"
const ghostBtnClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"

export default function TerminalSettingsSidebar({
  expanded,
  onExpandedChange,
  hiddenPanels,
  onAddPanel,
  suggestedPanels,
  onAddSuggested,
  presets,
  currentPreset,
  onSelectPreset,
  workspaces,
  selectedWorkspaceId,
  onSelectWorkspace,
  onUpdateWorkspace,
  updateDisabled,
  workspaceName,
  onWorkspaceNameChange,
  onSaveWorkspace,
  saveDisabled,
  onResetWorkspace,
}: TerminalSettingsSidebarProps) {
  const { t } = useTranslation("terminal")
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const asideRef = useRef<HTMLElement>(null)

  const highDensity = useTerminalDisplayStore((state) => state.highDensity)
  const setHighDensity = useTerminalDisplayStore((state) => state.setHighDensity)
  const gridSnapping = useTerminalDisplayStore((state) => state.gridSnapping)
  const setGridSnapping = useTerminalDisplayStore((state) => state.setGridSnapping)
  const panelLabels = useTerminalDisplayStore((state) => state.panelLabels)
  const setPanelLabels = useTerminalDisplayStore((state) => state.setPanelLabels)

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
      if (window.innerWidth >= 768) setIsMobileOpen(false)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isMobileOpen])

  const panelBody = (isMobile: boolean) => (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2 pb-4">
      <div>
        <p className={sectionLabelClass}>{t("suggested")}</p>
        {suggestedPanels.length === 0 ? (
          <p className="rounded-md bg-muted px-3 py-4 text-center text-xs text-muted-foreground">{t("addSuggestedEmpty")}</p>
        ) : (
          <>
            <p className="mb-2 text-[11px] leading-4 text-muted-foreground">
              {t("addSuggestedCount", { count: suggestedPanels.length })}
            </p>
            <button
              type="button"
              onClick={() => {
                onAddSuggested()
                if (isMobile) setIsMobileOpen(false)
              }}
              className={primaryBtnClass}
            >
              {t("addSuggested")}
            </button>
          </>
        )}
      </div>

      <div>
        <p className={sectionLabelClass}>{t("panelLibrary")}</p>
        <p className="mb-2 text-[11px] leading-4 text-muted-foreground">{t("panelLibraryHint")}</p>
        {hiddenPanels.length === 0 ? (
          <p className="rounded-md bg-muted px-3 py-4 text-center text-xs text-muted-foreground">{t("panelLibraryEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {hiddenPanels.map((panel) => (
              <li key={panel.id}>
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/x-panel-id", panel.id)}
                  onClick={() => {
                    onAddPanel(panel.id)
                    if (isMobile) setIsMobileOpen(false)
                  }}
                  className="w-full cursor-grab rounded-md border border-transparent px-2.5 py-2 text-left text-[13px] text-foreground transition-colors hover:border-border hover:bg-muted active:cursor-grabbing"
                >
                  {PANEL_TITLES[panel.id] ?? panel.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className={sectionLabelClass}>{t("displayPreferences")}</p>
        <div className="flex flex-col gap-1">
          <PreferenceToggle label={t("highDensityMode")} checked={highDensity} onChange={setHighDensity} />
          <PreferenceToggle label={t("showGridLines")} checked={gridSnapping} onChange={setGridSnapping} />
          <PreferenceToggle label={t("panelLabels")} checked={panelLabels} onChange={setPanelLabels} />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <p className={sectionLabelClass}>{t("loadWorkspace")}</p>
        <select
          value={currentPreset}
          onChange={(e) => onSelectPreset(e.target.value as PresetValue)}
          aria-label={t("preset")}
          className={fieldClass}
        >
          {presets.map((preset) => (
            <option key={preset} value={preset}>
              {t(PRESET_LABELS[preset])}
            </option>
          ))}
        </select>
        <select
          value={selectedWorkspaceId}
          onChange={(e) => onSelectWorkspace(e.target.value)}
          className={fieldClass}
          aria-label={t("loadWorkspace")}
        >
          <option value="">{t("loadWorkspace")}</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        {/* Only meaningful once a workspace is actually loaded — saves the current layout back
         * onto that same row (PATCH) instead of always minting a new named one. */}
        {selectedWorkspaceId && (
          <button type="button" disabled={updateDisabled} onClick={onUpdateWorkspace} className={primaryBtnClass}>
            {t("saveChanges")}
          </button>
        )}
        <input
          value={workspaceName}
          onChange={(e) => onWorkspaceNameChange(e.target.value)}
          placeholder={t("workspaceName")}
          className={fieldClass}
        />
        <button type="button" disabled={saveDisabled} onClick={onSaveWorkspace} className={ghostBtnClass}>
          {t("saveAsNew")}
        </button>
        <button type="button" onClick={onResetWorkspace} className={ghostBtnClass}>
          {t("reset")}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label={t("sidebarOpen")}
            className="absolute left-2 top-2 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-lg backdrop-blur-md hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 md:hidden"
          >
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("sidebarOpen")}</TooltipContent>
      </Tooltip>

      <aside
        ref={asideRef}
        className={`absolute inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-border bg-sidebar py-3 shadow-lg transition-[width] duration-200 md:flex ${
          expanded ? "w-72" : "w-16"
        }`}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              aria-label={expanded ? t("sidebarCollapse") : t("sidebarOpen")}
              className={`mx-2 mb-2 flex h-9 shrink-0 items-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/30 ${
                expanded ? "justify-between px-2.5" : "justify-center px-0"
              }`}
            >
              {expanded && (
                <span className="text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                  {t("sidebarWorkspaceSettings")}
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
        {/* Kept mounted (not conditionally rendered) and cross-faded instead — mounting it
         * only once `expanded` is already true made the text pop in at full width instantly
         * while the aside was still mid-animation on its own 200ms width transition, so it
         * visibly reflowed/rewrapped every frame as the width grew. The opacity transition's
         * delay is tuned to trail the width transition on expand (so text only appears once
         * there's room for it) and lead it on collapse (so text disappears before the width
         * starts shrinking under it). */}
        <div
          aria-hidden={!expanded}
          className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity ${
            expanded ? "duration-150 delay-150 opacity-100" : "pointer-events-none duration-75 opacity-0"
          }`}
        >
          {panelBody(false)}
        </div>
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileOpen(false)} aria-hidden="true" />
          <div className="relative flex h-full w-[85vw] max-w-80 flex-col bg-sidebar py-3 shadow-xl">
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                {t("sidebarWorkspaceSettings")}
              </span>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label={t("sidebarClose")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/30"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {panelBody(true)}
          </div>
        </div>
      )}
    </>
  )
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1.5 hover:bg-muted">
      <span className="text-[13px] text-foreground">{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand-gold" : "bg-muted-foreground/30"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  )
}
