// Tree → React Flow graph for the 2D mind map. Pure (no React, no DOM) so the spacing, colour
// and performance rules below are unit-tested directly (layout.test.ts).
import { MarkerType, type Edge, type Node } from 'reactflow';
import { MIND_MAP_HEX_COLORS, MIND_MAP_THEME, fixedNodeDescription } from './constants';
import { countDescendants } from './collapse';

export type MindMapLayout = 'horizontal' | 'vertical' | 'compact' | 'radial' | 'dual';

/** Above this many visible nodes, edges stop animating and React Flow only renders what's in
 * the viewport — a 150-node map with every edge animating was the main cost when panning. */
export const MIND_MAP_PERF_THRESHOLD = 60;

const ROOT_COLOR = '#722f37';
const SIBLING_GAP = 28;
const LEAF_MIN_HEIGHT = 130;
const LEAF_MIN_WIDTH = 260;
/** Horizontal distance between levels (node max width 450 + room for the edge). */
const LEVEL_X = 550;
const LEVEL_X_COMPACT = 500;
const LEVEL_Y_VERTICAL = 400;
/** Radial: distance between rings, and the arc each node on a ring needs. */
const RING_STEP = 600;
const RING_NODE_ARC = 380;

function getChildren(item: any): any[] {
  return item.children || item.items || item.nodes || item.subnodes || item.branches || item.subitems || [];
}

function labelOf(item: any): string {
  return item.label || item.text || 'Untitled';
}

/**
 * How much room a node's box needs, estimated from its label — CustomNode renders labels at a
 * fixed 32px (42px root) inside a 280–450px wide box that wraps, so a long label is a taller box.
 * An estimate rather than a DOM measurement: layout runs before React Flow has sized anything,
 * and a close estimate is what stops long labels overlapping their neighbours.
 */
export function estimateNodeSize(item: any, isRoot = false): { width: number; height: number } {
  const label = labelOf(item);
  const charWidth = isRoot ? 25 : 19;
  const width = Math.min(450, Math.max(280, label.length * charWidth + 64));
  const charsPerLine = Math.max(1, Math.floor((width - 64) / charWidth));
  const lines = Math.max(1, Math.ceil(label.length / charsPerLine));
  const height = 40 + lines * (isRoot ? 48 : 36);
  return { width, height };
}

/** The space one node takes along the axis siblings are stacked on. */
function footprint(item: any, layout: MindMapLayout, isRoot = false): number {
  const { width, height } = estimateNodeSize(item, isRoot);
  return layout === 'vertical' ? Math.max(LEAF_MIN_WIDTH, width + 40) : Math.max(LEAF_MIN_HEIGHT, height + 30);
}

/** Visible node count per depth (collapsed subtrees excluded) — sizes the radial rings. */
function countPerDepth(root: any, collapsed: Set<string>): number[] {
  const counts: number[] = [];
  const walk = (item: any, depth: number) => {
    counts[depth] = (counts[depth] ?? 0) + 1;
    if (depth > 0 && item.id && collapsed.has(item.id)) return;
    for (const child of getChildren(item)) walk(child, depth + 1);
  };
  walk(root, 0);
  return counts;
}

/** Ring radius per depth: at least RING_STEP further out than the ring inside it, and wide
 * enough that the nodes on it get RING_NODE_ARC each instead of piling up. */
export function radialRingRadii(countsPerDepth: number[]): number[] {
  const radii = [0];
  for (let d = 1; d < countsPerDepth.length; d++) {
    const needed = ((countsPerDepth[d] ?? 0) * RING_NODE_ARC) / (2 * Math.PI);
    radii[d] = Math.max(radii[d - 1]! + RING_STEP, needed);
  }
  return radii;
}

export function buildMindMapGraph(
  root: any,
  layout: MindMapLayout,
  collapsed: Set<string>,
  rootTitle: string,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const subtreeSizes = new Map<any, number>();
  const calcSize = (item: any, isRootItem = false): number => {
    // A collapsed node reserves only its own footprint — its hidden descendants shouldn't push
    // siblings apart. Root is never collapsible, so it always sizes by its real children.
    const own = footprint(item, layout, isRootItem);
    const children = !isRootItem && item.id && collapsed.has(item.id) ? [] : getChildren(item);
    const total = children.reduce((sum: number, child: any) => sum + calcSize(child), 0) + Math.max(0, children.length - 1) * SIBLING_GAP;
    const size = Math.max(own, total);
    subtreeSizes.set(item, size);
    return size;
  };
  calcSize(root, true);
  const sizeOf = (item: any) => subtreeSizes.get(item) ?? footprint(item, layout);

  const ringRadii = layout === 'radial' ? radialRingRadii(countPerDepth(root, collapsed)) : [];

  const traverse = (
    item: any,
    parentId: string | null,
    x: number,
    y: number,
    angleRange: [number, number],
    depth: number,
    side: 'left' | 'right' | 'top' | 'bottom',
    /** Which first-level branch this node belongs to — the whole branch shares one colour, so
     * in a 5-level map you can still tell which branch a deep node is part of. -1 = root. */
    branch: number,
  ) => {
    const id = item.id || `node-${Math.random().toString(36).substr(2, 9)}`;
    const isRoot = id === 'root' || !parentId;

    const hexColor = isRoot ? ROOT_COLOR : MIND_MAP_HEX_COLORS[branch % MIND_MAP_HEX_COLORS.length];
    const className = isRoot ? MIND_MAP_THEME.rootClass : MIND_MAP_THEME.nodeClass(branch);

    let label = labelOf(item);
    // Root + the five fixed first-level nodes get a static description; everything deeper keeps
    // the model's. See MIND_MAP_FIXED_NODE_DESCRIPTIONS.
    const description = fixedNodeDescription({ id, label, isRoot }) ?? (item.description || item.details || item.summary || '');
    if (isRoot && (label === 'Case Analysis' || label === 'Legal Strategy Map')) label = rootTitle;

    const box = estimateNodeSize(item, isRoot);
    const children = getChildren(item);
    const isCollapsible = !isRoot && children.length > 0;
    const isCollapsed = isCollapsible && collapsed.has(id);

    nodes.push({
      id,
      type: 'custom',
      data: {
        label,
        description,
        media: item.media, // Pass media data forward for 2D/3D
        isRoot,
        color: hexColor,
        className,
        layout,
        side, // Pass the calculated side to the node
        isCollapsible,
        isCollapsed,
        collapsedCount: isCollapsed ? countDescendants(item) : 0,
        // For the Expand button (see nodesWithCallbacks) — maps saved before the API set `depth`
        // fall back to the position in this walk, which is the same number.
        depth: typeof item.depth === 'number' ? item.depth : depth,
        hasMore: item.hasMore === true,
        // Only the verdicts that ask for the lawyer's attention are marked on the canvas;
        // SUPPORTED stays quiet (the detail panel still says so).
        reviewVerdict:
          item.check?.verdict === 'UNSUPPORTED' || item.check?.verdict === 'CONTRADICTED'
            ? item.check.verdict
            : item.sourceRemoved
              ? 'SOURCE_REMOVED'
              : null,
        childCount: children.length,
      },
      // (x, y) is the centre of the node's slot; React Flow positions a node by its top-left
      // corner, so shift by half the box — otherwise a tall node runs into the sibling below.
      position: { x: x - box.width / 2, y: y - box.height / 2 },
    });

    if (parentId) {
      // Root node in Dual/Radial has multiple source handles (left, right, top, bottom)
      const isFromRoot = parentId === 'root' && (layout === 'dual' || layout === 'radial');
      edges.push({
        id: `e${parentId}-${id}`,
        source: parentId,
        target: id,
        sourceHandle: isFromRoot ? side : undefined,
        style: { stroke: hexColor, strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: hexColor },
      });
    }

    if (isCollapsed || children.length === 0) return;
    const childBranch = (index: number) => (isRoot ? index : branch);

    if (layout === 'radial') {
      // Positions are relative to the root at (0,0) on concentric rings, not to the parent.
      const radius = ringRadii[depth + 1] ?? RING_STEP * (depth + 1);
      const [startAngle, endAngle] = angleRange;
      const anglePerChild = (endAngle - startAngle) / children.length;
      children.forEach((child: any, index: number) => {
        const angle = startAngle + anglePerChild * index + anglePerChild / 2;
        const normalized = ((angle % 360) + 360) % 360;
        const rad = (angle * Math.PI) / 180;
        // Map the angle to the best handle on the parent/root
        let childSide: 'left' | 'right' | 'top' | 'bottom' = 'right';
        if (normalized >= 45 && normalized < 135) childSide = 'bottom';
        else if (normalized >= 135 && normalized < 225) childSide = 'left';
        else if (normalized >= 225 && normalized < 315) childSide = 'top';
        const childStart = startAngle + anglePerChild * index;
        traverse(child, id, radius * Math.cos(rad), radius * Math.sin(rad), [childStart, childStart + anglePerChild], depth + 1, childSide, childBranch(index));
      });
      return;
    }

    if (layout === 'dual' && isRoot) {
      const midway = Math.ceil(children.length / 2);
      const halves: [any[], 'left' | 'right', number, number][] = [
        [children.slice(0, midway), 'left', -LEVEL_X, 0],
        [children.slice(midway), 'right', LEVEL_X, midway],
      ];
      for (const [half, halfSide, dx, firstIndex] of halves) {
        const total = half.reduce((acc: number, c: any) => acc + sizeOf(c), 0) + Math.max(0, half.length - 1) * SIBLING_GAP;
        let offset = -(total / 2);
        half.forEach((child: any, i: number) => {
          const size = sizeOf(child);
          traverse(child, id, x + dx, y + offset + size / 2, [0, 0], 1, halfSide, firstIndex + i);
          offset += size + SIBLING_GAP;
        });
      }
      return;
    }

    let offset = -(sizeOf(item) / 2);
    const childrenTotal = children.reduce((acc: number, c: any) => acc + sizeOf(c), 0) + (children.length - 1) * SIBLING_GAP;
    // Centre the children on the parent even when the parent's own box is the larger footprint.
    offset += (sizeOf(item) - childrenTotal) / 2;
    children.forEach((child: any, index: number) => {
      const size = sizeOf(child);
      const along = offset + size / 2;
      if (layout === 'vertical') traverse(child, id, x + along, y + LEVEL_Y_VERTICAL, [0, 0], depth + 1, side, childBranch(index));
      else if (layout === 'dual') traverse(child, id, x + (side === 'left' ? -LEVEL_X : LEVEL_X), y + along, [0, 0], depth + 1, side, childBranch(index));
      else traverse(child, id, x + (layout === 'compact' ? LEVEL_X_COMPACT : LEVEL_X), y + along, [0, 0], depth + 1, side, childBranch(index));
      offset += size + SIBLING_GAP;
    });
  };

  traverse(root, null, 0, 0, [0, 360], 0, 'right', -1);

  const animated = nodes.length <= MIND_MAP_PERF_THRESHOLD;
  return { nodes, edges: edges.map((e) => ({ ...e, animated })) };
}
