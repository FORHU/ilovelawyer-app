"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react"
import { TerminalPanelBody } from "@/components/terminal/terminal-panels"
import { useCaseSnapshotQuery, useTerminalCatalogQuery } from "@/lib/terminal/mutations"
import { HIDDEN_PANELS, PANEL_TITLES, isPanelId, terminalWindowPath } from "@/lib/terminal/panels"

export default function TerminalPopout({ caseId, panelId }: { caseId: string; panelId: string }) {
  const { t } = useTranslation("terminal")
  const snapshot = useCaseSnapshotQuery(caseId)
  const catalog = useTerminalCatalogQuery()

  if (!isPanelId(panelId) || HIDDEN_PANELS.has(panelId)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background font-['Inter'] text-sm">
        <AlertCircle className="h-6 w-6 text-red-400" aria-hidden="true" />
        <p className="text-red-400">{t("windowUnavailable")}</p>
        <Link href={`/homepage/terminal/${caseId}`} className="text-xs font-semibold uppercase tracking-wider text-brand-gold hover:underline">
          {t("backToWorkspace")}
        </Link>
      </div>
    )
  }

  const available = catalog.data?.panels.find((panel) => panel.id === panelId)?.available !== false
  if (catalog.data && !available) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background font-['Inter'] text-sm">
        <AlertCircle className="h-6 w-6 text-red-400" aria-hidden="true" />
        <p className="text-red-400">{t("windowUnavailable")}</p>
        <Link href={`/homepage/terminal/${caseId}`} className="text-xs font-semibold uppercase tracking-wider text-brand-gold hover:underline">
          {t("backToWorkspace")}
        </Link>
      </div>
    )
  }

  if (snapshot.isLoading || catalog.isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background font-['Inter'] text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("loading")}
      </div>
    )
  }

  if (snapshot.isError || !snapshot.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background font-['Inter'] text-sm">
        <AlertCircle className="h-6 w-6 text-red-400" aria-hidden="true" />
        <p className="text-red-400">{t("loadError")}</p>
        <button type="button" onClick={() => snapshot.refetch()} className="text-xs font-semibold uppercase tracking-wider text-brand-gold hover:underline">
          {t("retry")}
        </button>
      </div>
    )
  }

  const label = PANEL_TITLES[panelId] ?? catalog.data?.panels.find((panel) => panel.id === panelId)?.label ?? panelId

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background font-['Inter'] text-foreground">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        <button
          type="button"
          onClick={() => {
            if (window.opener && !window.opener.closed) {
              window.opener.focus()
              window.close()
              return
            }
            window.location.assign(`/homepage/terminal/${caseId}`)
          }}
          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t("backToWorkspace")}
        </button>
        <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
        <p className="min-w-0 truncate font-['Libre_Caslon_Text'] text-sm text-foreground">
          {snapshot.data.case.caseName}
        </p>
        <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-card">
        <TerminalPanelBody
          panelId={panelId}
          caseId={caseId}
          snapshot={snapshot.data}
          basePath={terminalWindowPath(caseId, panelId)}
        />
      </div>
    </div>
  )
}
