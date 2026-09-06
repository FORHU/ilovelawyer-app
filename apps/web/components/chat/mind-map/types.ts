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
  regenerating?: boolean;
  onRegenerate?: () => void;
}

// 3D mind map rendering consumes flexible, AI-shaped tree structures.
// Keep this intentionally permissive so 2D/3D can share the same `data` input.
export type MindMapItem = any;
