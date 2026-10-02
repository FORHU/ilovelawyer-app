import { useTranslation } from "react-i18next"
import { Check, CircleCheck, Loader2 } from "lucide-react"
import type { TodoSource, useLinkedTodos } from "@/lib/terminal/linked-todos"

/** Sends one item to Case Strategy's to-dos; shows "Added" while an open to-do is linked to it. */
export function ToChecklistButton({
  todos,
  source,
  label,
  sourceLabel,
}: {
  todos: ReturnType<typeof useLinkedTodos>
  source: TodoSource
  /** What the to-do says: the task, not the problem. */
  label: string
  /** Shown on the to-do as where it came from. */
  sourceLabel: string
}) {
  const { t } = useTranslation("terminal")
  const added = todos.isOnChecklist(source)
  const sending = todos.isSending(source)
  return (
    <button
      type="button"
      disabled={added || sending}
      onClick={() => todos.send(source, label, sourceLabel)}
      title={added ? t("addedToChecklistHint") : t("toChecklistHint")}
      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      {sending ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : added ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <CircleCheck className="h-3 w-3" aria-hidden="true" />
      )}
      {added ? t("addedToChecklist") : t("toChecklist")}
    </button>
  )
}
