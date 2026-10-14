"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Trash2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Badge } from "@workspace/ui/components/badge"
import {
  useAddCustodyEventMutation,
  useDeleteCustodyEventMutation,
  useUpdateEvidenceMatrixMutation,
} from "@/lib/terminal/mutations"
import type {
  HearsayCategory,
  PrivilegeStatus,
  SnapshotDocument,
  SnapshotEvidenceMatrixItem,
  Witness,
} from "@/lib/terminal/types"
import { focusFirstInvalid } from "@/lib/focus-first-invalid"
import { useCanContributeToCase } from "@/lib/cases/permissions"
import { Field, MutationError, dangerIconBtnClass, fieldClass, formatDate, primaryBtnClass } from "@/components/terminal/panel-kit"
import { HEARSAY_CATEGORY_KEYS, PRIVILEGE_STATUS_KEYS } from "@/components/terminal/panels/evidence-panel"

export function EvidenceDetailDrawer({
  open,
  onOpenChange,
  caseId,
  document,
  matrixItem,
  witnesses,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  document: SnapshotDocument | null
  matrixItem: SnapshotEvidenceMatrixItem | undefined
  witnesses: Witness[]
}) {
  const { t } = useTranslation("terminal")
  const updateMatrix = useUpdateEvidenceMatrixMutation(caseId)
  const addCustody = useAddCustodyEventMutation(caseId)
  const deleteCustody = useDeleteCustodyEventMutation(caseId)
  // A view-only person on a confidential case sees the metadata but can't change it.
  const viewOnly = !useCanContributeToCase(caseId)

  const [custodianName, setCustodianName] = useState("")
  const [custodyAction, setCustodyAction] = useState("")
  const [custodyDate, setCustodyDate] = useState("")
  const [custodyNotes, setCustodyNotes] = useState("")
  const [custodySubmitted, setCustodySubmitted] = useState(false)
  const requiredMsg = (key: string) => t("fieldRequiredNamed", { field: t(key) })

  if (!document) return null

  const custodyEvents = matrixItem?.custodyEvents ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{document.name}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div>
            <label className="mb-1 block text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">
              {t("privilegeStatus")}
            </label>
            <select
              value={matrixItem?.privilegeStatus ?? "NONE"}
              onChange={(e) =>
                updateMatrix.mutate({
                  documentId: document.id,
                  privilegeStatus: e.target.value as PrivilegeStatus,
                })
              }
              disabled={viewOnly}
              title={viewOnly ? t("viewOnlyConfidential") : undefined}
              className={`w-full ${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {(Object.keys(PRIVILEGE_STATUS_KEYS) as PrivilegeStatus[]).map(
                (status) => (
                  <option key={status} value={status}>
                    {t(PRIVILEGE_STATUS_KEYS[status])}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">
              {t("hearsayCategory")}
            </label>
            <select
              value={matrixItem?.hearsayCategory ?? "NOT_APPLICABLE"}
              onChange={(e) =>
                updateMatrix.mutate({
                  documentId: document.id,
                  hearsayCategory: e.target.value as HearsayCategory,
                })
              }
              disabled={viewOnly}
              title={viewOnly ? t("viewOnlyConfidential") : undefined}
              className={`w-full ${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {(Object.keys(HEARSAY_CATEGORY_KEYS) as HearsayCategory[]).map(
                (category) => (
                  <option key={category} value={category}>
                    {t(HEARSAY_CATEGORY_KEYS[category])}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">
              {t("sponsoringWitness")}
            </label>
            {witnesses.length === 0 ? (
              <p className="rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                {t("noWitnessesForSponsor")}
              </p>
            ) : (
              <select
                value={matrixItem?.sponsoringWitnessId ?? ""}
                onChange={(e) =>
                  updateMatrix.mutate({
                    documentId: document.id,
                    sponsoringWitnessId: e.target.value || null,
                  })
                }
                disabled={viewOnly}
                title={viewOnly ? t("viewOnlyConfidential") : undefined}
                className={`w-full ${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="">{t("noSponsoringWitness")}</option>
                {witnesses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <MutationError show={updateMatrix.isError} />

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">
                {t("chainOfCustody")}
              </label>
              <Badge tone={custodyEvents.length === 0 ? "warning" : "neutral"}>
                {t("custodyEventCount", { n: custodyEvents.length })}
              </Badge>
            </div>

            {custodyEvents.length === 0 ? (
              <p className="rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                {t("noCustodyEvents")}
              </p>
            ) : (
              <ul className="space-y-2">
                {custodyEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {event.custodianName}
                      </p>
                      <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                        {event.action}
                      </p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {formatDate(event.occurredAt)}
                      </p>
                      {event.notes ? (
                        <p className="mt-1 text-[12px] text-foreground">
                          {event.notes}
                        </p>
                      ) : null}
                    </div>
                    {!viewOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          deleteCustody.mutate({
                            documentId: document.id,
                            eventId: event.id,
                          })
                        }
                        disabled={deleteCustody.isPending}
                        className={dangerIconBtnClass}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!viewOnly && (
              <form
                noValidate
                className="mt-2 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const name = custodianName.trim()
                  const action = custodyAction.trim()
                  if (!name || !action || !custodyDate) {
                    setCustodySubmitted(true)
                    focusFirstInvalid(e.currentTarget)
                    return
                  }
                  addCustody.mutate({
                    documentId: document.id,
                    custodianName: name,
                    action,
                    occurredAt: custodyDate,
                    notes: custodyNotes.trim() || undefined,
                  })
                  setCustodianName("")
                  setCustodyAction("")
                  setCustodyDate("")
                  setCustodyNotes("")
                  setCustodySubmitted(false)
                }}
              >
                <Field
                  label={t("custodianName")}
                  htmlFor="custody-name"
                  required
                  error={custodySubmitted && !custodianName.trim() ? requiredMsg("custodianName") : null}
                >
                  <input
                    id="custody-name"
                    value={custodianName}
                    onChange={(e) => setCustodianName(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field
                  label={t("custodyActionLabel")}
                  htmlFor="custody-action"
                  required
                  error={custodySubmitted && !custodyAction.trim() ? requiredMsg("custodyActionLabel") : null}
                >
                  <input
                    id="custody-action"
                    value={custodyAction}
                    onChange={(e) => setCustodyAction(e.target.value)}
                    placeholder={t("custodyAction")}
                    className={fieldClass}
                  />
                </Field>
                <Field
                  label={t("custodyDateLabel")}
                  htmlFor="custody-date"
                  required
                  error={custodySubmitted && !custodyDate ? requiredMsg("custodyDateLabel") : null}
                >
                  <input
                    id="custody-date"
                    type="date"
                    value={custodyDate}
                    onChange={(e) => setCustodyDate(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label={t("custodyNotes")} htmlFor="custody-notes">
                  <textarea
                    id="custody-notes"
                    value={custodyNotes}
                    onChange={(e) => setCustodyNotes(e.target.value)}
                    rows={2}
                    className={`resize-none py-1.5 ${fieldClass} h-auto`}
                  />
                </Field>
                <button
                  type="submit"
                  disabled={addCustody.isPending}
                  className={primaryBtnClass}
                >
                  {t("addCustodyEvent")}
                </button>
              </form>
            )}
            <MutationError show={addCustody.isError || deleteCustody.isError} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
