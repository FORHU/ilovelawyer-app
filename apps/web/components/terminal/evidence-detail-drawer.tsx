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
import {
  fieldClass,
  formatDate,
  HEARSAY_CATEGORY_KEYS,
  PRIVILEGE_STATUS_KEYS,
  primaryBtnClass,
} from "@/components/terminal/terminal-panels"

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

  const [custodianName, setCustodianName] = useState("")
  const [custodyAction, setCustodyAction] = useState("")
  const [custodyDate, setCustodyDate] = useState("")
  const [custodyNotes, setCustodyNotes] = useState("")

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
              className={`w-full ${fieldClass}`}
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
              className={`w-full ${fieldClass}`}
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
                className={`w-full ${fieldClass}`}
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
                    <button
                      type="button"
                      onClick={() =>
                        deleteCustody.mutate({
                          documentId: document.id,
                          eventId: event.id,
                        })
                      }
                      disabled={deleteCustody.isPending}
                      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-500 disabled:opacity-50"
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="mt-2 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const name = custodianName.trim()
                const action = custodyAction.trim()
                if (!name || !action || !custodyDate) return
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
              }}
            >
              <input
                value={custodianName}
                onChange={(e) => setCustodianName(e.target.value)}
                placeholder={t("custodianName")}
                className={fieldClass}
              />
              <input
                value={custodyAction}
                onChange={(e) => setCustodyAction(e.target.value)}
                placeholder={t("custodyAction")}
                className={fieldClass}
              />
              <input
                type="date"
                value={custodyDate}
                onChange={(e) => setCustodyDate(e.target.value)}
                className={fieldClass}
              />
              <textarea
                value={custodyNotes}
                onChange={(e) => setCustodyNotes(e.target.value)}
                placeholder={t("custodyNotes")}
                rows={2}
                className={`resize-none py-1.5 ${fieldClass} h-auto`}
              />
              <button
                type="submit"
                disabled={addCustody.isPending}
                className={primaryBtnClass}
              >
                {t("addCustodyEvent")}
              </button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
