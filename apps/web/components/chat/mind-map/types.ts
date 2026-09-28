export interface MapNode {
  id: string;
  text?: string;
  label?: string;
  color?: string;
  children: MapNode[];
}

export interface MindMapProps {
  rootTitle?: string;
  data?: any;
  /** Scopes the "last known map" localStorage recovery cache to this consultation, so
   * refreshing one consultation's Mind Map tab doesn't show a different consultation's map. */
  consultationId?: string;
  /** Case has newer activity (CaseSnapshot.mindMap.isStale) than this map's generation.
   * Omit/false hides the toolbar badge entirely. */
  isStale?: boolean;
  /** What made it stale, when known — e.g. "2 documents added, 1 removed". Shown on the badge. */
  staleDetail?: string;
  regenerating?: boolean;
  /** The Regenerate button's tooltip while `regenerating` — e.g. "Generating mind map…" when an
   * Analysis Refresh is what will replace the map. Defaults to "Regenerating…". */
  regeneratingLabel?: string;
  onRegenerate?: () => void;
  /** "Expand with AI" — omit to hide it (e.g. a map with no consultation behind it). Built by
   * useMindMapExpansion (lib/chat/use-mind-map-expansion.ts). */
  expansion?: MindMapExpansion;
  /** Case document names by id — the detail panel names a node's cited documents with these.
   * Without it, citations show without a name. */
  documentNames?: Record<string, string>;
}

export interface MindMapExpansion {
  /** Resolves true once the new children are saved and in the messages cache. */
  expand: (nodeId: string) => Promise<boolean>;
  /** Node ids on this map with an expand request in flight. */
  expandingNodeIds: ReadonlySet<string>;
  /** Set while expanding isn't allowed right now (a chat reply is generating) — shown as the hint. */
  disabledReason?: string;
  /** Expand/edit changes since the map was generated (version − 1) — Regenerate warns before
   * replacing them. */
  expandedCount: number;
  /** Rename / add a point / delete, saved on the API. Resolves with the node to focus afterwards
   * (see NodeEditor), or null when it failed. */
  edit: (edit: MindMapEditRequest) => Promise<string | null>;
}

export type MindMapEditRequest =
  | { op: 'add'; nodeId: string; label: string; description?: string }
  | { op: 'rename'; nodeId: string; label: string; description?: string }
  | { op: 'delete'; nodeId: string };

// 3D mind map rendering consumes flexible, AI-shaped tree structures.
// Keep this intentionally permissive so 2D/3D can share the same `data` input.
export type MindMapItem = any;
