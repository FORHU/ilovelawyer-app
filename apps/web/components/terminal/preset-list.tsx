"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Trash2 } from "lucide-react"
import { ModalOverlay } from "@/components/terminal/terminal-canvas"
import { presetLabel, type ScreenPresetDef } from "@/lib/terminal/screen-presets"

interface PresetListProps {
  presets: ScreenPresetDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

/** The preset row list shared by ScreenPresetsModal (apply mode) and LayoutBuilderModal (template
 * picker) — name + total pane count, with a delete affordance on presets the caller owns
 * (`preset.userId` set; a system preset has none). Grouped under "My Presets" / "System Presets"
 * (`preset.userId` is the only signal for which group a preset belongs to) so a lawyer's own
 * saved layouts aren't mixed in with the seeded catalog. Deleting asks first — the confirm dialog
 * lives here (not in each caller) since both callers want identical behavior.
 */
export function PresetList({ presets, selectedId, onSelect, onDelete }: PresetListProps) {
  const { t } = useTranslation("terminal")
  const activeId = selectedId ?? presets[0]?.id
  const mine = presets.filter((p) => p.userId)
  const system = presets.filter((p) => !p.userId)
  const [pendingDelete, setPendingDelete] = useState<ScreenPresetDef | null>(null)

  const row = (preset: ScreenPresetDef) => (
    <div
      key={preset.id}
      className={`group flex w-full items-center gap-1 px-2 transition-colors ${
        activeId === preset.id ? "bg-brand-gold/10 text-foreground" : "text-muted-foreground hover:bg-muted/50"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(preset.id)}
        className="flex flex-1 items-center justify-between gap-2 py-2.5 pl-2 text-left text-xs hover:text-foreground"
      >
        <span className="font-semibold uppercase tracking-[0.5px]">{presetLabel(preset, t)}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{preset.screens.reduce((n, s) => n + s.panelIds.length, 0)}</span>
      </button>
      {preset.userId && (
        <button
          type="button"
          onClick={() => setPendingDelete(preset)}
          aria-label={t("deletePreset")}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  )

  return (
    <div className="relative flex-1 overflow-y-auto py-2">
      {mine.length > 0 && (
        <div className="flex flex-col">
          <p className="px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[1.2px] text-muted-foreground/70">{t("myPresets")}</p>
          {mine.map(row)}
        </div>
      )}
      {system.length > 0 && (
        <div className="flex flex-col">
          <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[1.2px] text-muted-foreground/70">{t("systemPresets")}</p>
          {system.map(row)}
        </div>
      )}

      {pendingDelete && (
        <ModalOverlay
          onClose={() => setPendingDelete(null)}
          labelledBy="delete-preset-title"
          aria-describedby="delete-preset-body"
          role="alertdialog"
          backdropClassName="fixed inset-0 z-[95] flex items-center justify-center bg-black/50"
          className="w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-4 shadow-2xl focus:outline-none"
        >
          {(close) => (
            <>
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p id="delete-preset-title" className="text-xs font-semibold uppercase tracking-[1.2px] text-foreground">
                    {t("deletePresetTitle")}
                  </p>
                  <p id="delete-preset-body" className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {t("deletePresetBody", { name: presetLabel(pendingDelete, t) })}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={close}
                  className="h-8 rounded-md border border-border bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(pendingDelete.id)
                    close()
                  }}
                  className="h-8 rounded-md bg-danger px-3 text-[10px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-danger/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                >
                  {t("deletePresetConfirm")}
                </button>
              </div>
            </>
          )}
        </ModalOverlay>
      )}
    </div>
  )
}
