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
