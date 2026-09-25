import type { TFunction } from "i18next";
import type { SnapshotCaseMindMapStatus } from "@/lib/terminal/types";

/** "2 documents added, 1 removed" for the case map's Stale badge — undefined when the snapshot
 * doesn't know what changed (a map built before that was tracked) or nothing did. Shared by
 * Studio and the Terminal's map panel. */
export function caseMindMapStaleDetail(t: TFunction, status: SnapshotCaseMindMapStatus | null | undefined): string | undefined {
  if (!status?.isStale) return undefined;
  const added = status.documentsAdded ?? 0;
  const removed = status.documentsRemoved ?? 0;
  if (!added && !removed) return undefined;
  if (added && removed) return t("caseMindMap.staleAddedRemoved", { added, removed, count: added });
  return added ? t("caseMindMap.staleAdded", { count: added }) : t("caseMindMap.staleRemoved", { count: removed });
}

/**
 * Whether a running Analysis Refresh is going to replace the case map — so it shows as
 * regenerating for the whole run, not just its last step. Not a map the lawyer has expanded or
 * edited (the refresh leaves those alone; they go Stale instead). With no live map (none yet, or
 * retired), only when the case has indexed documents to build one from.
 */
export function refreshWillReplaceCaseMap(p: {
  isRefreshing: boolean;
  map: { expandedCount?: number; retiredAt?: string | null } | null;
  hasIndexedDocuments: boolean;
}): boolean {
  if (!p.isRefreshing) return false;
  const liveMap = p.map && !p.map.retiredAt ? p.map : null;
  return liveMap ? (liveMap.expandedCount ?? 0) === 0 : p.hasIndexedDocuments;
}
