"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useFeedbackStore } from "@/lib/store/feedback.store"
import { FeedbackForm } from "@/components/feedback/feedback-form"

/** The header's Feedback drawer: opened from the header pill (desktop) or the menu (phone), over every
 * signed-in page. Laid out like Ask the guide's drawer, which it replaces while it's open. */
export function FeedbackDrawer() {
  const { t } = useTranslation("common")
  const open = useFeedbackStore((s) => s.open)
  const setOpen = useFeedbackStore((s) => s.setOpen)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, setOpen])

  if (!open) return null
  const close = () => setOpen(false)
  const title = t("feedback.title", { defaultValue: "Tell us what happened" })

  return (
    <>
      <div aria-hidden="true" onClick={close} className="fixed inset-0 z-[9049] bg-black/40 sm:hidden" />
      <aside
        role="dialog"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-[9050] flex w-full flex-col border-l border-border bg-background text-foreground shadow-2xl animate-in slide-in-from-right duration-300 sm:top-16 sm:w-[400px]"
      >
        <div className="flex items-start gap-2.5 border-b border-border px-5 pt-4.5 pb-3.5">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("feedback.eyebrow", { defaultValue: "Feedback" })}</span>
            <span className="font-['Libre_Caslon_Text'] text-2xl font-light tracking-[-0.01em]">{title}</span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("feedback.close", { defaultValue: "Close feedback" })}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        {/* pr-20 keeps Send clear of the Guide launcher that floats over this corner. */}
        <FeedbackForm layout="drawer" source="GENERAL" onSent={close} onCancel={close} footerClassName="pr-20" />
      </aside>
    </>
  )
}
