import { useTranslation } from "react-i18next"

export type AudioOverviewView = "current" | "history"

/** Current / History switch shared by Studio's Audio Overview tile and the terminal panel —
 * the counterpart of the Case Brief's Generate / Preview / History tabs. */
export function AudioOverviewViewTabs({
  view,
  onChange,
}: {
  view: AudioOverviewView
  onChange: (view: AudioOverviewView) => void
}) {
  const { t } = useTranslation("case-portfolio")
  const tabs: { key: AudioOverviewView; label: string }[] = [
    { key: "current", label: t("workspace.audioOverviewCurrentTab") },
    { key: "history", label: t("workspace.audioOverviewHistoryTab") },
  ]
  return (
    <div role="tablist" aria-label={t("workspace.audioOverviewTile")} className="flex shrink-0 gap-0.5 rounded-full border border-border p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={view === tab.key}
          onClick={() => onChange(tab.key)}
          className={`h-6 rounded-full px-3 text-xs font-medium transition-colors ${
            view === tab.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
