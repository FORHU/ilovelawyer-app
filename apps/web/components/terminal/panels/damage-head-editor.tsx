import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  DAMAGE_AS_OF,
  type DamageBasis,
  type DamageCategory,
  type DamageClaim,
  type DamageClaimBody,
  type DamageStatus,
  type DamagesSummary,
} from "@/lib/terminal/types"
import { DAMAGE_CATEGORY_ORDER, formatMoney, previewAmount } from "@/lib/terminal/damages-format"
import { Field, fieldClass, ghostBtnClass, labelTextClass, primaryBtnClass } from "@/components/terminal/panel-kit"

export const DAMAGE_CATEGORY_KEYS: Record<DamageCategory, string> = {
  ACTUAL: "damageActual",
  MORAL: "damageMoral",
  EXEMPLARY: "damageExemplary",
  ATTORNEYS_FEES: "damageAttorneysFees",
  OTHER: "damageOther",
}

export const DAMAGE_STATUS_KEYS: Record<DamageStatus, string> = {
  PROVISIONAL: "damageStatusProvisional",
  SUPPORTED: "damageStatusSupported",
  CERTIFIED: "damageStatusCertified",
}

type BasisKind = DamageBasis["kind"]

const BASIS_KIND_KEYS: Record<BasisKind, string> = {
  FIXED: "damageBasisFixed",
  RATE_X_PERIOD: "damageBasisRate",
  PERCENT_OF: "damageBasisPercent",
}

// Attorney's fees default to the mockup's model: 10% of Actual + Moral + Exemplary.
const DEFAULT_FEE_BASIS = { percent: "10", categories: ["ACTUAL", "MORAL", "EXEMPLARY"] as DamageCategory[] }

interface Draft {
  category: DamageCategory
  label: string
  kind: BasisKind
  amount: string
  monthlyRate: string
  periodMode: "months" | "dates"
  months: string
  fromDate: string
  untilDate: string
  /** Backwages keep running until the decision is final: the period ends "today" (untilDate asOf). */
  accruing: boolean
  highUntilDate: string
  percent: string
  categories: DamageCategory[]
  amountLow: string
  amountHigh: string
  status: DamageStatus
  pendingEvidence: string
  legalBasis: string
  description: string
}

const str = (n: number | null | undefined) => (n == null ? "" : String(n))
const num = (s: string): number | null => (s.trim() === "" ? null : Number(s))

function draftFrom(head: DamageClaim | null, accept: boolean): Draft {
  const basis = head?.basis ?? { kind: "FIXED" as const }
  const fees = !head || head.category === "ATTORNEYS_FEES"
  // A rate with no period yet (an AI head from a payslip): start from "since a date, accruing to
  // today" — how backwages usually run — so the lawyer only has to pick the start date.
  const rateWithoutPeriod =
    basis.kind === "RATE_X_PERIOD" && basis.months === undefined && !(basis.fromDate && basis.untilDate)
  return {
    category: head?.category ?? "ACTUAL",
    label: head?.label ?? "",
    kind: basis.kind,
    amount: basis.kind === "FIXED" ? str(head?.amount) : "",
    monthlyRate: basis.kind === "RATE_X_PERIOD" ? str(basis.monthlyRate) : "",
    periodMode: basis.kind === "RATE_X_PERIOD" && (basis.fromDate || rateWithoutPeriod) ? "dates" : "months",
    months: basis.kind === "RATE_X_PERIOD" ? str(basis.months) : "",
    fromDate: basis.kind === "RATE_X_PERIOD" ? (basis.fromDate ?? "").slice(0, 10) : "",
    untilDate:
      basis.kind === "RATE_X_PERIOD" && basis.untilDate !== DAMAGE_AS_OF ? (basis.untilDate ?? "").slice(0, 10) : "",
    accruing: basis.kind === "RATE_X_PERIOD" && (basis.untilDate === DAMAGE_AS_OF || rateWithoutPeriod),
    highUntilDate: basis.kind === "RATE_X_PERIOD" ? (basis.highUntilDate ?? "").slice(0, 10) : "",
    percent: basis.kind === "PERCENT_OF" ? str(basis.percent) : fees ? DEFAULT_FEE_BASIS.percent : "",
    categories: basis.kind === "PERCENT_OF" ? basis.categories : DEFAULT_FEE_BASIS.categories,
    amountLow: str(head?.amountLow),
    amountHigh: str(head?.amountHigh),
    // Accepting an AI head moves it to Supported, as the row's Accept button does.
    status: accept && head?.status === "PROVISIONAL" ? "SUPPORTED" : (head?.status ?? "PROVISIONAL"),
    pendingEvidence: head?.pendingEvidence ?? "",
    legalBasis: head?.legalBasis ?? "",
    description: head?.description ?? "",
  }
}

/** The basis the draft describes, or null while its inputs are incomplete. */
function basisFrom(d: Draft): DamageBasis | null {
  if (d.kind === "FIXED") return { kind: "FIXED" }
  if (d.kind === "RATE_X_PERIOD") {
    const monthlyRate = num(d.monthlyRate)
    if (monthlyRate == null) return null
    if (d.periodMode === "months") {
      const months = num(d.months)
      return months == null ? null : { kind: "RATE_X_PERIOD", monthlyRate, months }
    }
    if (!d.fromDate) return null
    if (!d.accruing && (!d.untilDate || d.untilDate < d.fromDate)) return null
    if (d.highUntilDate && d.highUntilDate < d.fromDate) return null
    return {
      kind: "RATE_X_PERIOD",
      monthlyRate,
      fromDate: d.fromDate,
      untilDate: d.accruing ? DAMAGE_AS_OF : d.untilDate,
      ...(d.highUntilDate ? { highUntilDate: d.highUntilDate } : {}),
    }
  }
  const percent = num(d.percent)
  if (percent == null || d.categories.length === 0) return null
  return { kind: "PERCENT_OF", percent, categories: d.categories }
}

export function DamageHeadEditor({
  head,
  summary,
  pending,
  accept = false,
  onSave,
  onCancel,
}: {
  /** The head being edited, or null to add a new one. */
  head: DamageClaim | null
  /** Opened from "Set period & accept": saving also accepts the head (status Supported). */
  accept?: boolean
  summary: DamagesSummary
  pending: boolean
  onSave: (body: DamageClaimBody & { category: DamageCategory }) => void
  onCancel: () => void
}) {
  const { t } = useTranslation("terminal")
  const id = useId()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(head, accept))
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const basis = basisFrom(draft)
  // Current amounts of the heads a percentage can be taken of (never another derived head, and
  // not the one being edited), for the live preview.
  const baseAmounts: Partial<Record<DamageCategory, number>> = {}
  for (const h of summary.heads) {
    if (h.derived || h.id === head?.id || h.amount == null) continue
    baseAmounts[h.category] = (baseAmounts[h.category] ?? 0) + h.amount
  }
  const preview = basis ? previewAmount(basis, num(draft.amount), baseAmounts) : undefined
  const low = num(draft.amountLow)
  const high = num(draft.amountHigh)
  const rangeInvalid = low != null && high != null && low > high
  const canSave = !pending && basis !== null && !rangeInvalid

  const fid = (name: string) => `${id}-${name}`

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
      aria-label={head ? t("damageEditorEdit") : t("damageEditorAdd")}
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave || !basis) return
        onSave({
          category: draft.category,
          label: draft.label.trim() || null,
          basis,
          amount: basis.kind === "FIXED" ? num(draft.amount) : undefined,
          amountLow: low,
          amountHigh: high,
          status: draft.status,
          pendingEvidence: draft.pendingEvidence.trim() || null,
          legalBasis: draft.legalBasis.trim() || null,
          description: draft.description.trim(),
        })
      }}
    >
      <p className={labelTextClass}>{head ? t("damageEditorEdit") : t("damageEditorAdd")}</p>
      {accept ? <p className="text-[12px] text-muted-foreground">{t("damageEditorAcceptHint")}</p> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("damageCategoryLabel")} htmlFor={fid("category")}>
          <select
            id={fid("category")}
            value={draft.category}
            onChange={(e) => {
              const category = e.target.value as DamageCategory
              // A new attorney's-fees head starts as the usual percentage rather than a blank amount.
              setDraft((d) => ({ ...d, category, kind: !head && category === "ATTORNEYS_FEES" ? "PERCENT_OF" : d.kind }))
            }}
            className={fieldClass}
          >
            {DAMAGE_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {t(DAMAGE_CATEGORY_KEYS[c])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("damageLabelField")} htmlFor={fid("label")} hint={t("damageLabelHint")}>
          <input id={fid("label")} value={draft.label} onChange={(e) => set("label", e.target.value)} className={fieldClass} />
        </Field>
      </div>

      <Field label={t("damageBasisKind")} htmlFor={fid("kind")}>
        <select
          id={fid("kind")}
          value={draft.kind}
          onChange={(e) => set("kind", e.target.value as BasisKind)}
          className={fieldClass}
        >
          {(Object.keys(BASIS_KIND_KEYS) as BasisKind[]).map((k) => (
            <option key={k} value={k}>
              {t(BASIS_KIND_KEYS[k])}
            </option>
          ))}
        </select>
      </Field>

      {draft.kind === "FIXED" ? (
        <Field label={t("damageAmount")} htmlFor={fid("amount")}>
          <input
            id={fid("amount")}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.amount}
            onChange={(e) => set("amount", e.target.value)}
            className={fieldClass}
          />
        </Field>
      ) : null}

      {draft.kind === "RATE_X_PERIOD" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("damageMonthlyRate")} htmlFor={fid("rate")}>
            <input
              id={fid("rate")}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              required
              value={draft.monthlyRate}
              onChange={(e) => set("monthlyRate", e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label={t("damagePeriodMode")} htmlFor={fid("period")}>
            <select
              id={fid("period")}
              value={draft.periodMode}
              onChange={(e) => set("periodMode", e.target.value as Draft["periodMode"])}
              className={fieldClass}
            >
              <option value="months">{t("damagePeriodMonths")}</option>
              <option value="dates">{t("damagePeriodDates")}</option>
            </select>
          </Field>
          {draft.periodMode === "months" ? (
            <Field label={t("damageMonths")} htmlFor={fid("months")}>
              <input
                id={fid("months")}
                type="number"
                min="0"
                max="1200"
                step="0.01"
                inputMode="decimal"
                required
                value={draft.months}
                onChange={(e) => set("months", e.target.value)}
                className={fieldClass}
              />
            </Field>
          ) : (
            <>
              <Field label={t("damageFromDate")} htmlFor={fid("from")}>
                <input
                  id={fid("from")}
                  type="date"
                  required
                  value={draft.fromDate}
                  onChange={(e) => set("fromDate", e.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label={t("damageUntilDate")} htmlFor={fid("until")}>
                <input
                  id={fid("until")}
                  type="date"
                  required={!draft.accruing}
                  disabled={draft.accruing}
                  min={draft.fromDate || undefined}
                  value={draft.accruing ? "" : draft.untilDate}
                  onChange={(e) => set("untilDate", e.target.value)}
                  className={`${fieldClass} disabled:opacity-50`}
                />
              </Field>
              <label
                htmlFor={fid("accruing")}
                className="inline-flex items-center gap-1.5 text-[13px] text-foreground sm:col-span-2"
              >
                <input
                  id={fid("accruing")}
                  type="checkbox"
                  checked={draft.accruing}
                  onChange={(e) => set("accruing", e.target.checked)}
                  className="accent-brand-gold"
                />
                {t("damageAccruing")}
              </label>
              <Field label={t("damageHighUntilDate")} htmlFor={fid("highUntil")} hint={t("damageHighUntilDateHint")}>
                <input
                  id={fid("highUntil")}
                  type="date"
                  min={draft.fromDate || undefined}
                  value={draft.highUntilDate}
                  onChange={(e) => set("highUntilDate", e.target.value)}
                  className={fieldClass}
                />
              </Field>
            </>
          )}
        </div>
      ) : null}

      {draft.kind === "PERCENT_OF" ? (
        <div className="flex flex-col gap-3">
          <Field label={t("damagePercent")} htmlFor={fid("percent")}>
            <input
              id={fid("percent")}
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              required
              value={draft.percent}
              onChange={(e) => set("percent", e.target.value)}
              className={`${fieldClass} max-w-32`}
            />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className={`mb-1.5 ${labelTextClass}`}>{t("damagePercentOf")}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {DAMAGE_CATEGORY_ORDER.map((c) => (
                <label key={c} htmlFor={fid(`of-${c}`)} className="inline-flex items-center gap-1.5 text-[13px] text-foreground">
                  <input
                    id={fid(`of-${c}`)}
                    type="checkbox"
                    checked={draft.categories.includes(c)}
                    onChange={(e) =>
                      set(
                        "categories",
                        e.target.checked ? [...draft.categories, c] : draft.categories.filter((x) => x !== c),
                      )
                    }
                    className="accent-brand-gold"
                  />
                  {t(DAMAGE_CATEGORY_KEYS[c])}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      <p className="font-mono text-[12px] text-foreground" aria-live="polite">
        {preview !== undefined
          ? t("damagePreview", { amount: formatMoney(preview, summary.currency) })
          : t("damagePreviewIncomplete")}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("damageRangeLow")} htmlFor={fid("low")} hint={t("damageRangeHint")}>
          <input
            id={fid("low")}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.amountLow}
            onChange={(e) => set("amountLow", e.target.value)}
            aria-invalid={rangeInvalid || undefined}
            className={fieldClass}
          />
        </Field>
        <Field label={t("damageRangeHigh")} htmlFor={fid("high")}>
          <input
            id={fid("high")}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.amountHigh}
            onChange={(e) => set("amountHigh", e.target.value)}
            aria-invalid={rangeInvalid || undefined}
            className={fieldClass}
          />
        </Field>
      </div>
      {rangeInvalid ? <p className="text-[11px] text-danger">{t("damageRangeInvalid")}</p> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("damageStatus")} htmlFor={fid("status")}>
          <select
            id={fid("status")}
            value={draft.status}
            onChange={(e) => set("status", e.target.value as DamageStatus)}
            className={fieldClass}
          >
            {(Object.keys(DAMAGE_STATUS_KEYS) as DamageStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(DAMAGE_STATUS_KEYS[s])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("damagePendingEvidence")} htmlFor={fid("pending")} hint={t("damagePendingEvidenceHint")}>
          <input
            id={fid("pending")}
            value={draft.pendingEvidence}
            onChange={(e) => set("pendingEvidence", e.target.value)}
            className={fieldClass}
          />
        </Field>
      </div>

      <Field label={t("damageLegalBasis")} htmlFor={fid("legal")}>
        <input id={fid("legal")} value={draft.legalBasis} onChange={(e) => set("legalBasis", e.target.value)} className={fieldClass} />
      </Field>
      <Field label={t("damageNotes")} htmlFor={fid("notes")}>
        <input id={fid("notes")} value={draft.description} onChange={(e) => set("description", e.target.value)} className={fieldClass} />
      </Field>

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
