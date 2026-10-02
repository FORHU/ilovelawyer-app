"use client"

import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import { popupSettingsPath } from "@/components/terminal/popup-setup-step"

interface MultiScreenGuideProps {
  expanded: boolean
  onToggle: () => void
}

// Up-front "how to use this" guide at the top of the presets modal, shown whenever more than one
// screen is connected — so a lawyer allows pop-ups before their first Apply instead of learning
// about the popup blocker from PopupSetupStep afterwards. Starts expanded; the modal collapses it
// for good once an Apply has opened every display (pop-ups are evidently allowed by then).
export function MultiScreenGuide({ expanded, onToggle }: MultiScreenGuideProps) {
  const { t } = useTranslation("terminal")

  const steps = [
    { title: t("multiScreenGuideStep1Title"), body: t("multiScreenGuideStep1", { path: popupSettingsPath() }) },
    { title: t("multiScreenGuideStep2Title"), body: t("multiScreenGuideStep2") },
    { title: t("multiScreenGuideStep3Title"), body: t("multiScreenGuideStep3") },
  ]

  return (
    <div className="mb-5 rounded-md border border-border/70 bg-muted/30">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("multiScreenGuideTitle")}</span>
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground hover:text-foreground">
          {expanded ? t("multiScreenGuideHide") : t("multiScreenGuideShow")}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>

      {expanded && (
        <ol className="grid gap-3 border-t border-border/70 px-4 py-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={index} className="flex min-w-0 gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-brand-gold-foreground">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
