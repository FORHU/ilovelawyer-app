import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Trash2 } from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { useCreateDamageMutation, useDeleteDamageMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot, DamageCategory } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, dangerIconBtnClass, fieldClass, primaryBtnClass } from "@/components/terminal/panel-kit"
import { usePrefersReducedMotion } from "@/lib/terminal/use-reduced-motion"

const DAMAGE_CATEGORY_KEYS: Record<DamageCategory, string> = {
  ACTUAL: "damageActual",
  MORAL: "damageMoral",
  EXEMPLARY: "damageExemplary",
  ATTORNEYS_FEES: "damageAttorneysFees",
  OTHER: "damageOther",
}

export function DamagePanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const create = useCreateDamageMutation(caseId)
  const del = useDeleteDamageMutation(caseId)
  const [category, setCategory] = useState<DamageCategory>("ACTUAL")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")

  const total = snapshot.damages.reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const reducedMotion = usePrefersReducedMotion()
  const [displayTotal, setDisplayTotal] = useState(total)
  const totalProxyRef = useRef({ value: total })
  const mountedRef = useRef(false)

  // Tweens the displayed total instead of snapping — skipped on first mount (nothing to count up
  // from) and whenever reduced-motion is on, both of which just jump straight to the real value.
  useGSAP(
    () => {
      if (!mountedRef.current || reducedMotion) {
        mountedRef.current = true
        totalProxyRef.current.value = total
        setDisplayTotal(total)
        return
      }
      gsap.to(totalProxyRef.current, {
        value: total,
        duration: 0.4,
        ease: "power2.out",
        onUpdate: () => setDisplayTotal(Math.round(totalProxyRef.current.value)),
      })
    },
    { dependencies: [total, reducedMotion] },
  )

  return (
    <PanelBody gap="4">
      {snapshot.damages.length === 0 ? (
        <EmptyNote>{t("noDamages")}</EmptyNote>
      ) : (
        <>
          <PanelRowList>
            {snapshot.damages.map((d) => (
              <PanelRow key={d.id} className="items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                    {t(DAMAGE_CATEGORY_KEYS[d.category])}
                  </p>
                  {d.description ? (
                    <p className="mt-0.5 text-[13px] leading-5 text-foreground">
                      {d.description}
                    </p>
                  ) : null}
                  {d.amount != null ? (
                    <p className="mt-1 font-mono text-[13px] text-foreground">
                      {d.amount.toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => del.mutate(d.id)}
                  disabled={del.isPending}
                  className={dangerIconBtnClass}
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </PanelRow>
            ))}
          </PanelRowList>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs font-semibold tracking-wider text-foreground uppercase">
            <span>{t("damageTotal")}</span>
            <span className="font-mono">{displayTotal.toLocaleString()}</span>
          </div>
        </>
      )}
      <form
        className="mt-auto flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const parsedAmount = amount.trim() ? Number(amount) : undefined
          create.mutate({
            category,
            description: description.trim() || undefined,
            amount: parsedAmount,
          })
          setDescription("")
          setAmount("")
        }}
      >
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DamageCategory)}
          aria-label={t("damageCategoryLabel")}
          className={fieldClass}
        >
          {(Object.keys(DAMAGE_CATEGORY_KEYS) as DamageCategory[]).map((c) => (
            <option key={c} value={c}>
              {t(DAMAGE_CATEGORY_KEYS[c])}
            </option>
          ))}
        </select>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("damageDescription")}
          aria-label={t("damageDescription")}
          className={fieldClass}
        />
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("damageAmount")}
            aria-label={t("damageAmount")}
            className={`flex-1 ${fieldClass}`}
          />
          <button
            type="submit"
            disabled={create.isPending}
            className={primaryBtnClass}
          >
            {t("add")}
          </button>
        </div>
      </form>
      <MutationError show={create.isError || del.isError} />
    </PanelBody>
  )
}
