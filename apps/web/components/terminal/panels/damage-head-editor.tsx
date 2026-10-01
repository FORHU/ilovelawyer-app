import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import type { DamageClaim, DamageClaimBody, DamageKind } from "@/lib/terminal/types"
import { Field, fieldClass, ghostBtnClass, labelTextClass, primaryBtnClass } from "@/components/terminal/panel-kit"

export const DAMAGE_KIND_KEYS: Record<DamageKind, string> = {
  DAMAGE: "damageKindDamage",
  REMEDY: "damageKindRemedy",
}

const KINDS: DamageKind[] = ["DAMAGE", "REMEDY"]

interface Draft {
  kind: DamageKind
  title: string
  description: string
  amount: string
  done: boolean
  dueDate: string
}

function draftOf(head: DamageClaim | null): Draft {
  return {
    kind: head?.kind ?? "DAMAGE",
    title: head?.title ?? "",
    description: head?.description ?? "",
    amount: head?.amount != null ? String(head.amount) : "",
    done: head?.done ?? false,
    // <input type="date"> takes YYYY-MM-DD.
    dueDate: head?.dueDate ? head.dueDate.slice(0, 10) : "",
  }
}

/** Add or edit one Damages & Remedies entry: kind, title, description, whether it is awarded or
 * received, amount and due date. */
export function DamageHeadEditor({
  head,
  pending,
  onSave,
  onCancel,
}: {
  head: DamageClaim | null
  pending: boolean
  onSave: (body: DamageClaimBody & Required<Pick<DamageClaimBody, "kind" | "title">>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation("terminal")
  const id = useId()
  const fid = (name: string) => `${id}-${name}`
  const [draft, setDraft] = useState<Draft>(() => draftOf(head))
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const amount = draft.amount.trim() === "" ? null : Number(draft.amount.replace(/,/g, ""))
  const amountInvalid = amount !== null && !(Number.isFinite(amount) && amount >= 0)
  const canSave = draft.title.trim() !== "" && !amountInvalid && !pending

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
      aria-label={head ? t("damageEditorEdit") : t("damageEditorAdd")}
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave) return
        onSave({
          kind: draft.kind,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          amount,
          done: draft.done,
          dueDate: draft.dueDate || null,
        })
      }}
    >
      <p className={labelTextClass}>{head ? t("damageEditorEdit") : t("damageEditorAdd")}</p>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${labelTextClass} mb-1.5`}>{t("damageKindLabel")}</legend>
        <div className="flex flex-wrap gap-4">
          {KINDS.map((kind) => (
            <label key={kind} className="inline-flex items-center gap-1.5 text-[13px] text-foreground">
              <input
                type="radio"
                name={fid("kind")}
                value={kind}
                checked={draft.kind === kind}
                onChange={() => set("kind", kind)}
                className="accent-brand-gold"
              />
              {t(DAMAGE_KIND_KEYS[kind])}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={t("damageTitleField")} htmlFor={fid("title")}>
        <input
          id={fid("title")}
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={t(draft.kind === "REMEDY" ? "damageTitleRemedyExample" : "damageTitleDamageExample")}
          maxLength={200}
          required
          className={fieldClass}
        />
      </Field>

      <Field label={t("damageDescriptionField")} htmlFor={fid("description")}>
        <textarea
          id={fid("description")}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          className={fieldClass}
        />
      </Field>

      <label className="inline-flex items-center gap-1.5 text-[13px] text-foreground">
        <input
          id={fid("done")}
          type="checkbox"
          checked={draft.done}
          onChange={(e) => set("done", e.target.checked)}
          className="accent-brand-gold"
        />
        {t("damageDoneField")}
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("damageAmountField")} htmlFor={fid("amount")} hint={t("damageAmountHint")}>
          <input
            id={fid("amount")}
            inputMode="decimal"
            value={draft.amount}
            onChange={(e) => set("amount", e.target.value)}
            aria-invalid={amountInvalid}
            className={fieldClass}
          />
        </Field>
        <Field label={t("damageDueDateField")} htmlFor={fid("dueDate")}>
          <input
            id={fid("dueDate")}
            type="date"
            value={draft.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
            className={fieldClass}
          />
        </Field>
      </div>
      {amountInvalid ? <p className="text-[12px] text-danger">{t("damageAmountInvalid")}</p> : null}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={ghostBtnClass}>
          {t("damageCancel")}
        </button>
        <button type="submit" disabled={!canSave} className={primaryBtnClass}>
          {t("damageSave")}
        </button>
      </div>
    </form>
  )
}
