import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Trash2 } from "lucide-react"
import { useCreateWitnessMutation, useDeleteWitnessMutation } from "@/lib/terminal/mutations"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, dangerIconBtnClass, fieldClass, primaryBtnClass } from "@/components/terminal/panel-kit"

// Reads the graph-view projection (view_type=witnesses) instead of slicing CaseSnapshot, so a
// witness added/removed from any mounted panel refreshes this one via the shared query cache.
export function WitnessPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const create = useCreateWitnessMutation(caseId)
  const del = useDeleteWitnessMutation(caseId)
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const graphView = useGraphViewQuery(caseId, "witnesses")
  const witnesses = graphView.data?.nodes ?? []

  return (
    <PanelBody gap="4">
      {witnesses.length === 0 ? (
        <EmptyNote>{t("noWitnesses")}</EmptyNote>
      ) : (
        <PanelRowList>
          {witnesses.map((node) => {
            const w = node.data as {
              name: string
              role?: string | null
              contact?: string | null
            }
            return (
              // No status field exists on Witness (no Ready/Adverse/Outstanding data to show).
              <PanelRow key={node.id} className="items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground">{w.name}</p>
                  {w.role ? (
                    <p className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                      {w.role}
                    </p>
                  ) : null}
                  {w.contact ? (
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {w.contact}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => del.mutate(node.refId)}
                  disabled={del.isPending}
                  className={dangerIconBtnClass}
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </PanelRow>
            )
          })}
        </PanelRowList>
      )}
      <form
        className="mt-auto flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = name.trim()
          if (!value) return
          create.mutate({ name: value, role: role.trim() || undefined })
          setName("")
          setRole("")
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("witnessName")}
          aria-label={t("witnessName")}
          className={fieldClass}
        />
        <div className="flex gap-2">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t("witnessRole")}
            aria-label={t("witnessRole")}
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
