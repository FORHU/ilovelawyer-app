// Pure tree helpers for the collapse/expand feature — kept dependency-free (no DOM, no
// reactflow) so they're unit-testable directly, and shared between the id-reconciliation effect
// and treeToGraph's collapsedCount badge.

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
