"use client"

import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { AlertCircle, Loader2 } from "lucide-react"
import { useCaseSnapshotQuery } from "@/lib/terminal/mutations"
import { PANEL_IDS, type PanelId } from "@/lib/terminal/types"
import { TerminalPanelBody } from "@/components/terminal/terminal-panels"
import { PANEL_TITLES } from "@/components/terminal/legal-terminal"
import { TerminalDisplayProvider } from "@/components/terminal/terminal-display-provider"

// Pop-out target for a single Terminal pane (see popOutPanel in legal-terminal.tsx) — a
// minimal, independent page, not the full app shell: no PageShell/GlobalHeader, no sidebar.
// Hits the same snapshot query and mutation hooks the embedded panel already uses; no
// cross-window sync with the opener, since a pane only ever renders in one place at a time
// (hidden in the main grid while its pop-out is open).
export default function TerminalPanelPopoutPage() {
  const { t } = useTranslation("terminal")
  const params = useParams<{ caseId: string; panelId: string }>()
  const caseId = params.caseId
  const panelId = params.panelId as PanelId
  const isValidPanel = (PANEL_IDS as readonly string[]).includes(panelId)
  const snapshot = useCaseSnapshotQuery(caseId)

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background font-['Inter'] text-foreground">
      <div className="flex h-10 shrink-0 items-center border-b border-border bg-card px-3">
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[1.4px] text-foreground uppercase">
          {isValidPanel ? PANEL_TITLES[panelId] : t("loadError")}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {!isValidPanel ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            {t("loadError")}
          </div>
        ) : snapshot.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : snapshot.isError || !snapshot.data ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
            <p className="text-destructive">{t("loadError")}</p>
            <button
              type="button"
              onClick={() => snapshot.refetch()}
              className="text-xs font-semibold tracking-wider text-brand-gold uppercase hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <TerminalDisplayProvider>
            <TerminalPanelBody panelId={panelId} caseId={caseId} snapshot={snapshot.data} />
          </TerminalDisplayProvider>
        )}
      </div>
    </div>
  )
}
