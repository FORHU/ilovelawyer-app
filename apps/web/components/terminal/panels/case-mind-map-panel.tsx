"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import ConsultationChat from "@/components/chat/consultation-chat"
import { MindMap } from "@/components/chat/mind-map"
import { useCaseMindMap, useGenerateCaseMindMapMutation } from "@/lib/case-workspace/case-mind-map"
import { caseMindMapStaleDetail } from "@/lib/case-workspace/case-mind-map-status"
import { useMindMapExpansion, type MindMapExpansionTarget } from "@/lib/chat/use-mind-map-expansion"
import { useCaseDocumentsQuery } from "@/lib/cases/mutations"
import type { CaseSnapshot } from "@/lib/terminal/types"

/**
 * The Legal Terminal's "Visual Strategy Map" panel. Shows the case's document-built map — the one
 * the case analysis update ("Refresh analysis", and the automatic run after documents change)
 * builds, same as Studio — with expand/edit/Regenerate. Only while the case has no such map does it
 * fall back to the chat-generated map this panel used to show (ConsultationChat's map-only mode).
 *
 * Each branch roots on `h-full`, not `flex-1`: legal-terminal.tsx's panel body wrapper is a plain
 * block, so `flex-1` there left the canvas at its 320px minimum however large the panel was made.
 */
export function CaseMindMapPanel({ caseId, snapshot }: { caseId: string; snapshot: CaseSnapshot }) {
  const { t } = useTranslation("case-portfolio")
  const caseMindMap = useCaseMindMap(caseId)
  const generate = useGenerateCaseMindMapMutation(caseId)
  const documentsQuery = useCaseDocumentsQuery(caseId)
  // Own build (blocks expand/edit) vs. what the Regenerate icon and building view show: that
  // build, or an Analysis Refresh that will end by replacing the map (useCaseMindMap).
  const isBuilding = caseMindMap.isBuilding || generate.isPending
  const isRegenerating = isBuilding || caseMindMap.refreshWillReplace
  const busyLabel = isBuilding ? t("caseMindMap.terminalBuilding") : t("workspace.mindMapGenerating")

  const target = useMemo<MindMapExpansionTarget | undefined>(
    () => (caseMindMap.tree && caseMindMap.map ? { kind: "case", caseId, expandedCount: caseMindMap.map.expandedCount ?? 0 } : undefined),
    [caseMindMap.tree, caseMindMap.map, caseId],
  )
  const expansion = useMindMapExpansion(target, { disabledReason: isBuilding ? t("caseMindMap.rebuilding") : undefined })
  const documentNames = useMemo(
    () => Object.fromEntries((documentsQuery.data ?? []).map((doc) => [doc.id, doc.name])),
    [documentsQuery.data],
  )

  if (caseMindMap.tree) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-2">
        {(caseMindMap.buildFailed || generate.isError) && !isRegenerating && (
          <p className="shrink-0 text-center text-xs text-red-600 dark:text-red-400">{t("caseMindMap.buildError")}</p>
        )}
        <div className="min-h-0 flex-1">
          <MindMap
            rootTitle={snapshot.case.caseName}
            data={caseMindMap.tree}
            consultationId={`case:${caseId}`}
            isStale={snapshot.caseMindMap?.isStale}
            staleDetail={caseMindMapStaleDetail(t, snapshot.caseMindMap)}
            regenerating={isRegenerating}
            regeneratingLabel={isBuilding ? undefined : busyLabel}
            onRegenerate={() => generate.mutate()}
            expansion={expansion}
            documentNames={documentNames}
          />
        </div>
      </div>
    )
  }

  if (isBuilding) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="max-w-xs text-sm text-muted-foreground">{busyLabel}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* An Analysis Refresh that's about to build the case's first map — which will replace the
       * chat-map fallback below. A banner rather than a full building view, so the fallback stays
       * readable through a refresh that can take minutes. */}
      {caseMindMap.refreshWillReplace ? (
        <p className="flex shrink-0 items-center justify-center gap-2 border-b border-border px-4 py-2 text-center text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {busyLabel}
        </p>
      ) : (
        caseMindMap.retired && (
          <p className="shrink-0 border-b border-border px-4 py-2 text-center text-xs text-muted-foreground">{t("caseMindMap.retired")}</p>
        )
      )}
      <ConsultationChat embedded isolateConsultation mindMapOnly basePath={`/homepage/terminal/${caseId}`} caseId={caseId} />
    </div>
  )
}
