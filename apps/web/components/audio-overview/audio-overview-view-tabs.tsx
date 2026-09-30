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
    <div role="tablist" className="flex shrink-0 gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={view === tab.key}
          onClick={() => onChange(tab.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            view === tab.key ? "bg-brand-navy-950 text-white dark:bg-foreground dark:text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
