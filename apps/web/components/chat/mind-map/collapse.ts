// Pure tree helpers for the collapse/expand feature — kept dependency-free (no DOM, no
// reactflow) so they're unit-testable directly, and shared between the id-reconciliation effect,
// the default "levels 0–2" collapse, and layout.ts's collapsedCount badge.

import type { MindMapItem } from './types';

function getChildren(item: any): any[] {
  if (!item || typeof item !== 'object') return [];
  return item.children || item.items || item.nodes || item.subnodes || item.branches || item.subitems || [];
}

/** Every node id present anywhere in the tree, root included. */
export function collectIds(root: any): Set<string> {
  const ids = new Set<string>();
  const walk = (item: any) => {
    if (!item) return;
    if (item.id) ids.add(item.id);
    for (const child of getChildren(item)) walk(child);
  };
  walk(root);
  return ids;
}

/** Drops any collapsed id that no longer exists in a freshly-generated tree — ids that survive
 * keep their collapsed state, ids that no longer exist (or are brand new) don't carry one. */
export function reconcileCollapsedIds(prev: Set<string>, root: any): Set<string> {
  const idsInTree = collectIds(root);
  const next = new Set<string>();
  for (const id of prev) {
    if (idsInTree.has(id)) next.add(id);
  }
  return next;
}

/** Total node count under (not including) `item` — used for a collapsed node's hidden-count badge. */
export function countDescendants(item: any): number {
  const children = getChildren(item);
  let count = children.length;
  for (const child of children) count += countDescendants(child);
  return count;
}

/** The collapsed-id set that shows levels 0..`level` and folds everything below: every node at
 * depth `level` that has children. `level` 1 = root + the five branches only. */
export function collapseBelowLevel(root: MindMapItem, level: number): Set<string> {
  const ids = new Set<string>();
  const walk = (item: MindMapItem, depth: number) => {
    if (!item) return;
    const children = getChildren(item);
    if (depth === level) {
      if (item.id && children.length > 0) ids.add(item.id);
      return;
    }
    for (const child of children) walk(child, depth + 1);
  };
  walk(root, 0);
  return ids;
}

/** Deepest level in the tree (root = 0) — how far the Structure menu's "Show levels" goes. */
export function treeDepth(root: MindMapItem): number {
  if (!root) return 0;
  const children = getChildren(root);
  return children.length ? 1 + Math.max(...children.map(treeDepth)) : 0;
}

/** Whether any node has something to review — a Jev check, or a citation to a removed document
 * — the Structure menu only offers "Highlight points to review" once there's something to
 * highlight. */
export function treeHasChecks(root: MindMapItem): boolean {
  if (!root) return false;
  if (root.check || root.sourceRemoved) return true;
  return getChildren(root).some(treeHasChecks);
}
