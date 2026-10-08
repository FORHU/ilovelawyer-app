import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  applyMindMapChange,
  editMindMapNode,
  expandMindMapNode,
  type MindMapChangeResult,
} from "@/lib/chat/mutations";
import {
  applyCaseMindMapChange,
  editCaseMindMapNode,
  expandCaseMindMapNode,
} from "@/lib/case-workspace/case-mind-map";
import type { ActiveMindMapRecord } from "@/lib/chat/mind-map-parser";
import { caseKeys, chatKeys } from "@/lib/query-keys";
import { mindMapNodeKey, useExpandingMindMapNodesStore } from "@/lib/store/expanding-mind-map-nodes.store";
import type { MindMapEditRequest, MindMapExpansion } from "@/components/chat/mind-map/types";
import { MIND_MAP_LIMITS } from "@/components/chat/mind-map/constants";

/** Which map "Expand with AI" acts on: a consultation's chat map (addressed by the message that
 * carries it) or the case's document-built map. */
export type MindMapExpansionTarget =
  | { kind: "consultation"; consultationId: string; record: ActiveMindMapRecord }
  | { kind: "case"; caseId: string; expandedCount: number };

/**
 * "Expand with AI" for one map — the shared wiring behind the chat's Mind Map tab and Studio's
 * Mind Map panel, so they behave identically: the request, the in-flight state (a store, so it
 * survives remounts), and swapping the new tree into the right cache.
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
        toast.success(t("mindMapExpand.expanded"));
        return true;
      } catch (err) {
        const { status, code, message } = err as { status?: number; code?: string; message?: string };
        console.error("Mind map expand failed", { nodeId, status, code, message });
        // No status: the request never got an answer (API restarted, connection dropped). The
        // expand may still have finished server-side, so refetch the map rather than guess.
        if (status === undefined) {
          void queryClient.invalidateQueries({
            queryKey: target.kind === "consultation" ? chatKeys.messages(target.consultationId) : caseKeys.mindMap(target.caseId),
          });
        }
        // The API's own reason ("Node not found on this mind map", "The AI didn't return any new
        // points…") beats a generic retry hint; its bare 500 doesn't.
        const serverReason = status !== undefined && message && message !== "Internal server error" ? message : undefined;
        toast.error(
          code === "MAX_NODES"
            ? t("mindMapExpand.limitNodes", { max: MIND_MAP_LIMITS.maxNodes })
            : code === "MAX_DEPTH"
              ? t("mindMapExpand.limitDepth")
              : status === 409
                ? t("mindMapExpand.alreadyExpanding")
                : status === undefined
                  ? t("mindMapExpand.networkError")
                  : (serverReason ?? t("mindMapExpand.error")),
        );
        return false;
      } finally {
        stop(key);
      }
    },
    [target, scope, settle, start, stop, t, queryClient],
  );

  /** Rename / add / delete — the same save-into-cache and toast as expand. */
  const edit = useCallback(
    async (change: MindMapEditRequest): Promise<string | null> => {
      if (!target) return null;
      try {
        const result =
          target.kind === "consultation"
            ? await editMindMapNode(target.consultationId, { messageId: target.record.messageId, ...change })
            : await editCaseMindMapNode(target.caseId, change);
        settle(result);
        // NodeEditor renames with the label alone and edits details with the description alone
        // (the label sent back unchanged), so a description on a rename means the details changed.
        toast.success(
          t(
            `mindMapEdit.${
              change.op === "add"
                ? "added"
                : change.op === "rename"
                  ? change.description !== undefined
                    ? "detailsSaved"
                    : "renamed"
                  : "deleted"
            }`,
          ),
        );
        return result.editedNodeId ?? change.nodeId;
      } catch (err) {
        const { status, code } = err as { status?: number; code?: string };
        toast.error(
          code === "MAX_NODES"
            ? t("mindMapExpand.limitNodes", { max: MIND_MAP_LIMITS.maxNodes })
            : code === "MAX_DEPTH"
              ? t("mindMapExpand.limitDepth")
              : status === 409
                ? t("mindMapEdit.changedElsewhere")
                : t("mindMapEdit.error"),
        );
        return null;
      }
    },
    [target, settle, t],
  );

  const expandingNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!scope) return ids;
    const prefix = `${scope}:`;
    for (const key of expandingKeys) if (key.startsWith(prefix)) ids.add(key.slice(prefix.length));
    return ids;
  }, [scope, expandingKeys]);

  // A chat map's version only ever moves by expand/edit (1 = as generated); the case map's also
  // moves on every rebuild, so the API counts its expansions for us.
  const expandedCount = target
    ? target.kind === "consultation"
      ? Math.max(0, target.record.version - 1)
      : target.expandedCount
    : 0;
  return useMemo(
    () => (target ? { expand, edit, expandingNodeIds, disabledReason: opts.disabledReason, expandedCount } : undefined),
    [target, expand, edit, expandingNodeIds, opts.disabledReason, expandedCount],
  );
}
