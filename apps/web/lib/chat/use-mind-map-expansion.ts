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
import {
  applyCaseMindMapChange,
  expandCaseMindMapNode,
  revertCaseMindMap,
} from "@/lib/case-workspace/case-mind-map";
import type { ActiveMindMapRecord } from "@/lib/chat/mind-map-parser";
import { caseKeys, chatKeys } from "@/lib/query-keys";
import { mindMapNodeKey, useExpandingMindMapNodesStore } from "@/lib/store/expanding-mind-map-nodes.store";
import type { MindMapExpansion } from "@/components/chat/mind-map/types";
import { MIND_MAP_LIMITS } from "@/components/chat/mind-map/constants";

/** Which map "Expand with AI" acts on: a consultation's chat map (addressed by the message that
 * carries it) or the case's document-built map. */
export type MindMapExpansionTarget =
  | { kind: "consultation"; consultationId: string; record: ActiveMindMapRecord }
  | { kind: "case"; caseId: string; expandedCount: number };

/**
 * "Expand with AI" for one map — the shared wiring behind the chat's Mind Map tab and Studio's
 * Mind Map panel, so they behave identically: the request, the in-flight state (a store, so it
 * survives remounts), swapping the new tree into the right cache, and the "Undo" toast.
 *
 * `disabledReason` is set while something is about to replace this map (a chat reply generating,
 * a rebuild running) — expanding is refused then, with that as the hint, same as Regenerate.
 */
export function useMindMapExpansion(
  target: MindMapExpansionTarget | undefined,
  opts: { disabledReason?: string } = {},
): MindMapExpansion | undefined {
  const { t } = useTranslation("case-portfolio");
  const queryClient = useQueryClient();
  const expandingKeys = useExpandingMindMapNodesStore((s) => s.expandingKeys);
  const start = useExpandingMindMapNodesStore((s) => s.start);
  const stop = useExpandingMindMapNodesStore((s) => s.stop);

  // Store keys are scoped per map, so a chat map and the case map can't share a node's spinner.
  const scope = target ? (target.kind === "consultation" ? target.consultationId : `case:${target.caseId}`) : undefined;

  const settle = useCallback(
    (result: MindMapChangeResult) => {
      if (!target) return;
      if (target.kind === "consultation") {
        applyMindMapChange(queryClient, target.consultationId, result);
        void queryClient.invalidateQueries({ queryKey: chatKeys.messages(target.consultationId) });
      } else {
        applyCaseMindMapChange(queryClient, target.caseId, result);
        void queryClient.invalidateQueries({ queryKey: caseKeys.mindMap(target.caseId) });
      }
    },
    [target, queryClient],
  );

  const undo = useCallback(
    async (result: MindMapChangeResult) => {
      if (!target) return;
      try {
        settle(
          target.kind === "consultation"
            ? await revertMindMap(target.consultationId, { messageId: result.messageId, version: result.version })
            : await revertCaseMindMap(target.caseId, { version: result.version }),
        );
        toast.success(t("mindMapExpand.undone"));
      } catch (err) {
        toast.error((err as { status?: number }).status === 409 ? t("mindMapExpand.undoStale") : t("mindMapExpand.undoError"));
      }
    },
    [target, settle, t],
  );

  const expand = useCallback(
    async (nodeId: string): Promise<boolean> => {
      if (!target || !scope) return false;
      const key = mindMapNodeKey(scope, nodeId);
      if (useExpandingMindMapNodesStore.getState().expandingKeys.has(key)) return false;
      start(key);
      try {
        const result =
          target.kind === "consultation"
            ? await expandMindMapNode(target.consultationId, { messageId: target.record.messageId, nodeId })
            : await expandCaseMindMapNode(target.caseId, { nodeId });
        settle(result);
        toast.success(t("mindMapExpand.expanded"), {
          action: { label: t("mindMapExpand.undo"), onClick: () => void undo(result) },
        });
        return true;
      } catch (err) {
        const { status, code } = err as { status?: number; code?: string };
        toast.error(
          code === "MAX_NODES"
            ? t("mindMapExpand.limitNodes", { max: MIND_MAP_LIMITS.maxNodes })
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
    [target, scope, settle, start, stop, t, undo],
  );

  const expandingNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!scope) return ids;
    const prefix = `${scope}:`;
    for (const key of expandingKeys) if (key.startsWith(prefix)) ids.add(key.slice(prefix.length));
    return ids;
  }, [scope, expandingKeys]);

  // A chat map's version only ever moves by expand/undo (1 = as generated); the case map's also
  // moves on every rebuild, so the API counts its expansions for us.
  const expandedCount = target
    ? target.kind === "consultation"
      ? Math.max(0, target.record.version - 1)
      : target.expandedCount
    : 0;
  return useMemo(
    () => (target ? { expand, expandingNodeIds, disabledReason: opts.disabledReason, expandedCount } : undefined),
    [target, expand, expandingNodeIds, opts.disabledReason, expandedCount],
  );
}
