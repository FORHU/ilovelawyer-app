"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import ConsultationChat from "@/components/chat/consultation-chat"
import { MindMap } from "@/components/chat/mind-map"
import { useCanContributeToCase } from "@/lib/cases/permissions"
import { useCaseMindMap, useGenerateCaseMindMapMutation } from "@/lib/case-workspace/case-mind-map"
import { PaneLoadingState, primaryBtnClass } from "@/components/terminal/panel-kit"
import { caseMindMapStaleDetail } from "@/lib/case-workspace/case-mind-map-status"
import { useMindMapExpansion, type MindMapExpansionTarget } from "@/lib/chat/use-mind-map-expansion"
import { useCaseDocumentsQuery } from "@/lib/cases/mutations"
import type { CaseSnapshot } from "@/lib/terminal/types"

/**
 * The Legal Terminal's "Visual Strategy Map" panel. Shows the case's document-built map — the one
 * the case analysis builds after documents change, same as Studio — with expand/edit and the
 * pane's own Regenerate (MindMap asks first when the map was expanded). Regenerate is held back
 * while the case analysis runs. With no such map yet, a case that has indexed documents gets
 * "Build from documents". Only a case with no indexed documents still falls back to the
 * chat-generated map (ConsultationChat's map-only mode).
 *
 * Each branch roots on `h-full`, not `flex-1`: legal-terminal.tsx's panel body wrapper is a plain
 * block, so `flex-1` there left the canvas at its 320px minimum however large the panel was made.
 */
export function CaseMindMapPanel({ caseId, snapshot }: { caseId: string; snapshot: CaseSnapshot }) {
  const { t: tTerminal } = useTranslation("terminal")
  const { t } = useTranslation("case-portfolio")
  const caseMindMap = useCaseMindMap(caseId)
  const generate = useGenerateCaseMindMapMutation(caseId)
  // View-only on a confidential case: no build or rebuild (expand/edit are held back inside
  // useMindMapExpansion).
  const canContribute = useCanContributeToCase(caseId)
  const documentsQuery = useCaseDocumentsQuery(caseId)
  // A build (blocks expand/edit) vs. what the spinner and building view show: that build, or an
  // Analysis Refresh that will end by replacing the map (useCaseMindMap).
  const isBuilding = caseMindMap.isBuilding || generate.isPending
  const isRegenerating = isBuilding || caseMindMap.refreshWillReplace

  const target = useMemo<MindMapExpansionTarget | undefined>(
    () => (caseMindMap.tree && caseMindMap.map ? { kind: "case", caseId, expandedCount: caseMindMap.map.expandedCount ?? 0 } : undefined),
    [caseMindMap.tree, caseMindMap.map, caseId],
  )
  const expansion = useMindMapExpansion(target, { disabledReason: isBuilding ? t("caseMindMap.rebuilding") : undefined })
  const documentNames = useMemo(
    () => Object.fromEntries((documentsQuery.data ?? []).map((doc) => [doc.id, doc.name])),
    [documentsQuery.data],
  )
  // Same test as useCaseMindMap's: documents the case map can be built from.
  const hasIndexedDocuments = (documentsQuery.data ?? []).some((doc) => doc.ragStatus === "READY" && doc.status !== "ARCHIVED")

  // While a build or the case analysis writes the map, the centered loading state replaces it,
  // as in every other pane.
  if (isBuilding || (caseMindMap.isRefreshing && (Boolean(caseMindMap.tree) || hasIndexedDocuments))) {
    return (
      <PaneLoadingState fill>
        {isBuilding ? tTerminal("paneRegenerating") : tTerminal("paneUpdatingWithAnalysis")}
      </PaneLoadingState>
    )
  }

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
            onRegenerate={canContribute ? () => generate.mutate() : undefined}
            expansion={expansion}
            documentNames={documentNames}
          />
        </div>
      </div>
    )
  }

  if (hasIndexedDocuments) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center-safe gap-4 overflow-y-auto p-4 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">
          {caseMindMap.retired
            ? t("caseMindMap.retired")
            : canContribute
              ? t("caseMindMap.emptyWithDocuments")
              : t("caseMindMap.viewOnly")}
        </p>
        {canContribute && (
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending || caseMindMap.isRefreshing}
            className={primaryBtnClass}
          >
            {t("caseMindMap.buildCta")}
          </button>
        )}
        {(caseMindMap.buildFailed || generate.isError) && (
          <p className="text-xs text-red-600 dark:text-red-400">{t("caseMindMap.buildError")}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* An Analysis Refresh that's about to build the case's first map — which will replace the
       * chat-map fallback below. A banner rather than a full building view, so the fallback stays
       * readable through a refresh that can take minutes. */}
      {caseMindMap.refreshWillReplace ? (
        <p className="flex shrink-0 items-center justify-center gap-2 border-b border-border px-4 py-2 text-center text-xs font-medium text-progress" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {tTerminal("paneUpdatingWithAnalysis")}
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
