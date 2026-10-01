import { useTranslation } from "react-i18next"

const STEP_KEYS = [
  "workspace.audioOverviewStepReading",
  "workspace.audioOverviewStepAnswering",
  "workspace.audioOverviewStepScripting",
] as const

/** The script generation's steps, advanced by the API's real progress (useAudioOverview's
 * scriptStep, from AiGenerationJob.stage) rather than a timer. `step` is the running one's index;
 * everything before it is done, everything after it still to come. */
export function AudioOverviewGenerationSteps({ step }: { step: number }) {
  const { t } = useTranslation("case-portfolio")
  return (
    <ol className="mt-1.5 flex w-full max-w-55 flex-col gap-1.5" aria-label={t("workspace.audioOverviewStepsLabel")}>
      {STEP_KEYS.map((key, i) => {
        const state = i < step ? "done" : i === step ? "current" : "pending"
        return (
          <li
            key={key}
            aria-current={state === "current" ? "step" : undefined}
            className={`flex items-center gap-2 text-[11px] ${
              state === "done" ? "text-muted-foreground" : state === "current" ? "text-foreground" : "text-muted-foreground/60"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                state === "done" ? "bg-ok" : state === "current" ? "bg-brand-gold" : "bg-border"
              }`}
            />
            {t(key)}
          </li>
        )
      })}
    </ol>
  )
}
