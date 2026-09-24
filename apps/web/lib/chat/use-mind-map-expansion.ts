import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  applyMindMapChange,
  expandMindMapNode,
  revertMindMap,
  type MindMapChangeResult,
} from "@/lib/chat/mutations";
import type { ActiveMindMapRecord } from "@/lib/chat/mind-map-parser";
import { chatKeys } from "@/lib/query-keys";
import { mindMapNodeKey, useExpandingMindMapNodesStore } from "@/lib/store/expanding-mind-map-nodes.store";
import type { MindMapExpansion } from "@/components/chat/mind-map/types";

/**
 * "Expand with AI" for one consultation's active mind map — the shared wiring behind both the
 * chat's Mind Map tab and Studio's Mind Map panel, so they behave identically: the request, the
 * in-flight state (a store, so it survives remounts), swapping the new tree into the messages
 * cache, and the "Undo" toast.
 *
 * `busy` is "a chat reply is being generated in this consultation" — expanding then is refused
 * with `disabledReason`, same as Regenerate, since that reply may replace the map anyway.
 */
export function useMindMapExpansion(
  consultationId: string | undefined,
  record: ActiveMindMapRecord | undefined,
  opts: { busy?: boolean } = {},
): MindMapExpansion | undefined {
  const { t } = useTranslation("case-portfolio");
  const queryClient = useQueryClient();
  const expandingKeys = useExpandingMindMapNodesStore((s) => s.expandingKeys);
  const start = useExpandingMindMapNodesStore((s) => s.start);
  const stop = useExpandingMindMapNodesStore((s) => s.stop);

  const settle = useCallback(
    (result: MindMapChangeResult) => {
      if (!consultationId) return;
      applyMindMapChange(queryClient, consultationId, result);
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(consultationId) });
    },
    [consultationId, queryClient],
  );

  const undo = useCallback(
    async (result: MindMapChangeResult) => {
      if (!consultationId) return;
      try {
        settle(await revertMindMap(consultationId, { messageId: result.messageId, version: result.version }));
        toast.success(t("mindMapExpand.undone"));
      } catch (err) {
        toast.error((err as { status?: number }).status === 409 ? t("mindMapExpand.undoStale") : t("mindMapExpand.undoError"));
      }
    },
    [consultationId, settle, t],
  );

  const expand = useCallback(
    async (nodeId: string): Promise<boolean> => {
      if (!consultationId || !record) return false;
      const key = mindMapNodeKey(consultationId, nodeId);
      if (useExpandingMindMapNodesStore.getState().expandingKeys.has(key)) return false;
      start(key);
      try {
        const result = await expandMindMapNode(consultationId, { messageId: record.messageId, nodeId });
        settle(result);
        toast.success(t("mindMapExpand.expanded"), {
          action: { label: t("mindMapExpand.undo"), onClick: () => void undo(result) },
        });
        return true;
      } catch (err) {
        const { status, code } = err as { status?: number; code?: string };
        toast.error(
          code === "MAX_NODES"
            ? t("mindMapExpand.limitNodes")
            : code === "MAX_DEPTH"
              ? t("mindMapExpand.limitDepth")
              : status === 409
                ? t("mindMapExpand.alreadyExpanding")
                : t("mindMapExpand.error"),
        );
        return false;
      } finally {
        stop(key);
      }
    },
    [consultationId, record, settle, start, stop, t, undo],
  );

  const expandingNodeIds = useMemo(() => {
    const prefix = consultationId ? `${consultationId}:` : null;
    const ids = new Set<string>();
    if (!prefix) return ids;
    for (const key of expandingKeys) if (key.startsWith(prefix)) ids.add(key.slice(prefix.length));
    return ids;
  }, [consultationId, expandingKeys]);

  return useMemo(
    () =>
      consultationId && record
        ? {
            expand,
            expandingNodeIds,
            disabledReason: opts.busy ? t("workspace.replyInProgressHint") : undefined,
            expandedCount: Math.max(0, record.version - 1),
          }
        : undefined,
    [consultationId, record, expand, expandingNodeIds, opts.busy, t],
  );
}
