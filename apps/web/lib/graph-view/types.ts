export type GraphViewType = "timeline" | "witnesses" | "contradictions" | "issues"

export interface GraphNode {
  id: string
  type: string
  refId: string
  label: string
  staleAt: string | null
  data: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relationType: string
  metadata: Record<string, unknown>
}

export interface GraphViewResponse {
  viewType: GraphViewType
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface CreateCaseEdgePayload {
  sourceEntityId: string
  targetEntityId: string
  relationType: "SUPPORTS" | "CONTRADICTS" | "CITES" | "PROVES" | "REFUTES" | "SPONSORS"
  metadata?: Record<string, unknown>
}
